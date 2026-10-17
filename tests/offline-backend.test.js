import { createTranslationPipeline } from '@@/public/offline/backend-selector.js';
import { describe, expect, it, vi } from 'vitest';

const MODEL_ID = 'onnx-community/opus-mt-mul-en';
const MODEL_OPTIONS = { dtype: 'q4' };

describe('offline backend selection', () => {
  it('uses WebGPU when it initializes successfully', async () => {
    const translate = vi.fn();
    const pipeline = vi.fn().mockResolvedValue(translate);

    await expect(
      createTranslationPipeline({
        pipeline,
        modelId: MODEL_ID,
        modelOptions: MODEL_OPTIONS,
        supportsWebGpu: true,
      }),
    ).resolves.toEqual({ backend: 'webgpu', translate });
    expect(pipeline).toHaveBeenCalledOnce();
    expect(pipeline).toHaveBeenCalledWith('translation', MODEL_ID, {
      ...MODEL_OPTIONS,
      device: 'webgpu',
    });
  });

  it('falls back to WASM when WebGPU initialization fails', async () => {
    const translate = vi.fn();
    const pipeline = vi
      .fn()
      .mockRejectedValueOnce(new Error('unsupported WebGPU operator'))
      .mockResolvedValueOnce(translate);

    await expect(
      createTranslationPipeline({
        pipeline,
        modelId: MODEL_ID,
        modelOptions: MODEL_OPTIONS,
        supportsWebGpu: true,
      }),
    ).resolves.toEqual({ backend: 'wasm', translate });
    expect(pipeline.mock.calls.map((call) => call[2].device)).toEqual([
      'webgpu',
      'wasm',
    ]);
  });

  it('uses WASM directly when WebGPU is unavailable', async () => {
    const translate = vi.fn();
    const pipeline = vi.fn().mockResolvedValue(translate);

    await createTranslationPipeline({
      pipeline,
      modelId: MODEL_ID,
      modelOptions: MODEL_OPTIONS,
      supportsWebGpu: false,
    });

    expect(pipeline).toHaveBeenCalledWith('translation', MODEL_ID, {
      ...MODEL_OPTIONS,
      device: 'wasm',
    });
  });
});
