import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('offline translation worker', () => {
  it('is owned by an extension page, not the website content script', async () => {
    const contentTranslator = await readFile(
      'src/translation/offline-wasm-translator.ts',
      'utf8',
    );

    expect(contentTranslator).not.toMatch(/\bnew Worker\s*\(/);
  });

  it('uses greedy decoding for interactive translation latency', async () => {
    const workerSource = await readFile('public/offline/worker.js', 'utf8');

    expect(workerSource).toMatch(
      /translate\(text,\s*\{\s*num_beams:\s*1\s*\}\)/,
    );
  });
});
