import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('offline ONNX Runtime assets', () => {
  it('installs both ONNX loader modules and WASM binaries', async () => {
    const installer = await readFile(
      'scripts/install-offline-model.mjs',
      'utf8',
    );

    expect(installer).toMatch(
      /filePath\.endsWith\('\.wasm'\).*filePath\.endsWith\('\.mjs'\)/s,
    );
  });
});
