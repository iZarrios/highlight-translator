import { z } from 'zod';

/** OpenAI strict structured outputs allow at most 100 object properties. */
export const MAX_MAPPED_WORDS = 100;

export type TextSpan = { start: number; end: number };

export type Word = TextSpan & { word: string };

/** Consecutive translation words and the source span they render, if any. */
export type WordGroup = {
  translation: TextSpan;
  source?: TextSpan;
};

export type WordMappingRequest = {
  text: string;
  translation: string;
};

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function splitWords(text: string): Word[] {
  return [...text.matchAll(WORD_PATTERN)].map((match) => ({
    word: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/**
 * Numbered labels make each word unique and let the model answer by choosing
 * from a fixed list instead of retyping words, which it does unreliably.
 */
export function wordLabels(words: Word[]): string[] {
  return words.map(({ word }, index) => `${index + 1}:${word}`);
}

/** One key per translation word, each listing the source words it renders. */
export function wordMappingSchema(
  translationLabels: string[],
  sourceLabels: string[],
) {
  return {
    type: 'object',
    properties: Object.fromEntries(
      translationLabels.map((label) => [
        label,
        { type: 'array', items: { type: 'string', enum: sourceLabels } },
      ]),
    ),
    required: translationLabels,
    additionalProperties: false,
  } as const;
}

export const wordMappingResponseSchema = z.record(
  z.string(),
  z.array(z.string()),
);

function sourceSpan(
  sourceWords: Word[],
  sourceIndex: Map<string, number>,
  labels: string[],
): TextSpan | undefined {
  const words = labels.flatMap((label) => {
    const word = sourceWords[sourceIndex.get(label) ?? -1];
    return word ? [word] : [];
  });
  if (words.length === 0) return undefined;
  return {
    start: Math.min(...words.map(({ start }) => start)),
    end: Math.max(...words.map(({ end }) => end)),
  };
}

const sameSpan = (left?: TextSpan, right?: TextSpan) =>
  left !== undefined &&
  right !== undefined &&
  left.start === right.start &&
  left.end === right.end;

/**
 * Maps the model's chosen source labels back onto real text positions.
 * Unknown labels are dropped, and neighbouring words that render the same
 * source span (an idiom) become one group.
 */
export function resolveWordMapping(
  sourceWords: Word[],
  translationWords: Word[],
  answer: Record<string, string[]>,
): WordGroup[] {
  const sourceIndex = new Map(
    wordLabels(sourceWords).map((label, index) => [label, index]),
  );
  const keys = wordLabels(translationWords);
  const groups: WordGroup[] = [];
  let lastMapped = -1;

  translationWords.forEach((word, index) => {
    const span = sourceSpan(
      sourceWords,
      sourceIndex,
      answer[keys[index] ?? ''] ?? [],
    );

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
