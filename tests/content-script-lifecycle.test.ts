import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('content-script lookup lifecycle', () => {
  it('does not dismiss an open lookup when the user scrolls', async () => {
    const contentScript = await readFile(
      'src/entrypoints/highlight.content/index.tsx',
      'utf8',
    );

    expect(contentScript).not.toMatch(
      /addEventListener\(\s*window,\s*['"]scroll['"]/,
    );

    const lookupCard = await readFile(
      'src/entrypoints/highlight.content/lookup-card.tsx',
      'utf8',
    );
    expect(lookupCard).toMatch(/addEventListener\(\s*['"]scroll['"]/);
    expect(lookupCard).toContain('selection.anchor.rectangle()');
  });
});
