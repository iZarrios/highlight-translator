import { describe, expect, it } from 'vitest';
import {
  resolveWordMapping,
  splitWords,
  wordLabels,
  wordMappingSchema,
} from '@/word-mapping';

const source = 'Il pleut des cordes, alors le chat reste sur le lit.';
const translation = "It's raining cats and dogs, so the cat stays on the bed.";

/** Builds an answer from the source word numbers chosen for each translation word. */
function answerFor(choices: number[][]): Record<string, string[]> {
  const sourceLabels = wordLabels(splitWords(source));
  return Object.fromEntries(
    wordLabels(splitWords(translation)).map((key, index) => [
      key,
      (choices[index] ?? []).map((number) => sourceLabels[number - 1] ?? ''),
    ]),
  );
}

function mapped(choices: number[][]) {
  return resolveWordMapping(
    splitWords(source),
    splitWords(translation),
    answerFor(choices),
  ).map((group) => [
    translation.slice(group.translation.start, group.translation.end),
    group.source
      ? source.slice(group.source.start, group.source.end)
      : undefined,
  ]);
}

describe('splitWords', () => {
  it('keeps apostrophes and hyphens inside words and skips punctuation', () => {
    expect(
      splitWords("It's a well-known fact, isn't it?").map(({ word }) => word),
    ).toEqual(["It's", 'a', 'well-known', 'fact', "isn't", 'it']);
  });

  it('numbers labels so repeated words stay unique', () => {
    expect(wordLabels(splitWords('the cat the dog'))).toEqual([
      '1:the',
      '2:cat',
      '3:the',
      '4:dog',
    ]);
  });
});

describe('wordMappingSchema', () => {
  it('lets each translation word choose only from the source labels', () => {
    expect(
      wordMappingSchema(['1:the', '2:car'], ['1:la', '2:voiture']),
    ).toEqual({
      type: 'object',
      properties: {
        '1:the': {
          type: 'array',
          items: { type: 'string', enum: ['1:la', '2:voiture'] },
        },
        '2:car': {
          type: 'array',
          items: { type: 'string', enum: ['1:la', '2:voiture'] },
        },
      },
      required: ['1:the', '2:car'],
      additionalProperties: false,
    });
  });
});

describe('resolveWordMapping', () => {
  it('merges an idiom split across words', () => {
    expect(mapped([[1], [2], [3, 4], [], [3, 4], [5]]).slice(0, 4)).toEqual([
      ["It's", 'Il'],
      ['raining', 'pleut'],
      ['cats and dogs', 'des cordes'],
      ['so', 'alors'],
    ]);
  });

  it('maps repeated words to the occurrence the model chose', () => {
    // "the cat" and "the bed": the second "le" (word 10) must not resolve to the first.
    const groups = mapped([
      [],
      [],
      [],
      [],
      [],
      [],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11],
    ]);
    expect(groups.slice(6)).toEqual([
      ['the', 'le'],
      ['cat', 'chat'],
      ['stays', 'reste'],
      ['on', 'sur'],
      ['the', 'le'],
      ['bed', 'lit'],
    ]);
    const starts = resolveWordMapping(
      splitWords(source),
      splitWords(translation),
      answerFor([[], [], [], [], [], [], [10], [], [], [], [6]]),
    ).flatMap(({ source: span }) => (span ? [span.start] : []));
    expect(starts).toEqual([45, 27]);
  });

  it('spans every chosen source word and drops unknown labels', () => {
    const [first, second] = resolveWordMapping(
      splitWords('il a cassé sa pipe'),
      splitWords('he died'),
      { '1:he': ['1:il', '9:nope'], '2:died': ['5:pipe', '2:a'] },
    );
    expect(first?.source).toEqual({ start: 0, end: 2 });
    expect(second?.source).toEqual({ start: 3, end: 18 });
    const [group] = resolveWordMapping(splitWords('il'), splitWords('he'), {
      '1:he': ['1:he'],
    });
    expect(group?.source).toBeUndefined();
  });
});
