import { describe, expect, it } from 'vitest';
import {
  alignmentKeys,
  resolveAlignment,
  splitWords,
} from '@/analysis/alignment';

const source = 'Il pleut des cordes, alors le chat reste sur le lit.';
const translation = "It's raining cats and dogs, so the cat stays on the bed.";

function answerFor(values: string[]): Record<string, string> {
  const keys = alignmentKeys(splitWords(translation));
  return Object.fromEntries(
    keys.map((key, index) => [key, values[index] ?? '']),
  );
}

function mapped(values: string[]) {
  return resolveAlignment(
    source,
    splitWords(translation),
    answerFor(values),
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

  it('numbers keys so repeated words stay unique', () => {
    expect(alignmentKeys(splitWords('the cat the dog'))).toEqual([
      '1 the',
      '2 cat',
      '3 the',
      '4 dog',
    ]);
  });
});

describe('resolveAlignment', () => {
  it('merges an idiom split across words and drops values not in the source', () => {
    expect(
      mapped(['Il', 'pleut', 'des cordes', 'et', 'des cordes', 'alors']).slice(
        0,
        3,
      ),
    ).toEqual([
      ["It's", 'Il'],
      ['raining', 'pleut'],
      ['cats and dogs', 'des cordes'],
    ]);
  });

  it('maps repeated words to the next occurrence and matches case-insensitively', () => {
    const groups = mapped([
      'il',
      'pleut',
      'des cordes',
      '',
      'des cordes',
      'alors',
      'le',
      'chat',
      'reste',
      'sur',
      'le',
      'lit',
    ]);
    expect(groups.slice(4)).toEqual([
      ['the', 'le'],
      ['cat', 'chat'],
      ['stays', 'reste'],
      ['on', 'sur'],
      ['the', 'le'],
      ['bed', 'lit'],
    ]);
    const spans = resolveAlignment(
      source,
      splitWords(translation),
      answerFor(['il', 'pleut', '', '', '', '', 'le', '', '', '', 'le']),
    ).flatMap(({ source: span }) => (span ? [span.start] : []));
    expect(spans).toEqual([0, 3, 27, 45]);
  });

  it('only matches whole words', () => {
    // "le" must not match inside "pleut".
    expect(mapped(['', '', '', '', '', '', 'le'])[6]).toEqual(['the', 'le']);
    const [group] = resolveAlignment('pleut', splitWords('the'), {
      '1 the': 'le',
    });
    expect(group?.source).toBeUndefined();
  });
});
