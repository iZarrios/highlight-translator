import { z } from 'zod';

/** OpenAI strict structured outputs allow at most 100 object properties. */
export const MAX_ALIGNMENT_WORDS = 100;

export type TextSpan = { start: number; end: number };

export type TranslationWord = TextSpan & { word: string };

/** Consecutive translation words and the source span they render, if any. */
export type AlignedGroup = {
  translation: TextSpan;
  source?: TextSpan;
};

export type AlignmentRequest = {
  text: string;
  translation: string;
};

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

export function splitWords(translation: string): TranslationWord[] {
  return [...translation.matchAll(WORD_PATTERN)].map((match) => ({
    word: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Numbered keys make each word unique and keep the model's answer in order. */
export function alignmentKeys(words: TranslationWord[]): string[] {
  const width = String(words.length).length;
  return words.map(
    ({ word }, index) => `${String(index + 1).padStart(width, '0')} ${word}`,
  );
}

export function alignmentSchema(keys: string[]) {
  return {
    type: 'object',
    properties: Object.fromEntries(
      keys.map((key) => [key, { type: 'string' }]),
    ),
    required: keys,
    additionalProperties: false,
  } as const;
}

export const alignmentResponseSchema = z.record(z.string(), z.string());

function isWordBoundary(text: string, index: number): boolean {
  return !WORD_CHARACTER.test(text[index] ?? '');
}

function findSourceSpan(
  source: string,
  value: string,
  from: number,
): TextSpan | undefined {
  const needle = value.trim().toLocaleLowerCase();
  const haystack = source.toLocaleLowerCase();
  if (!needle || haystack.length !== source.length) return undefined;

  for (const start of [from, 0]) {
    let index = haystack.indexOf(needle, start);
    while (index !== -1) {
      const end = index + needle.length;
      if (isWordBoundary(source, index - 1) && isWordBoundary(source, end))
        return { start: index, end };
      index = haystack.indexOf(needle, index + 1);
    }
  }
  return undefined;
}

const sameSpan = (left?: TextSpan, right?: TextSpan) =>
  left !== undefined &&
  right !== undefined &&
  left.start === right.start &&
  left.end === right.end;

/**
 * Maps the model's answer back onto real text positions. Values that are not
 * verbatim in the source are dropped, and neighbouring words that render the
 * same source span (an idiom) become one group.
 */
export function resolveAlignment(
  source: string,
  words: TranslationWord[],
  answer: Record<string, string>,
): AlignedGroup[] {
  const keys = alignmentKeys(words);
  const groups: AlignedGroup[] = [];
  let cursor = 0;
  let lastMapped = -1;

  words.forEach((word, index) => {
    const span = findSourceSpan(
      source,
      answer[keys[index] ?? ''] ?? '',
      cursor,
    );
    if (span) cursor = span.end;

    const previous = groups[lastMapped];
    if (span && previous && sameSpan(previous.source, span)) {
      // Absorb any unmapped words between the two halves of the expression.
      groups.splice(lastMapped + 1);
      previous.translation = {
        start: previous.translation.start,
        end: word.end,
      };
      return;
    }

    groups.push({
      translation: { start: word.start, end: word.end },
      ...(span ? { source: span } : {}),
    });
    if (span) lastMapped = groups.length - 1;
  });

  return groups;
}
