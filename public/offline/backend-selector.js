export async function createTranslationPipeline({
  pipeline,
  modelId,
  modelOptions,
  supportsWebGpu,
}) {
  if (supportsWebGpu) {
    try {
      return {
        backend: 'webgpu',
        translate: await pipeline('translation', modelId, {
          ...modelOptions,
          device: 'webgpu',
        }),
      };
    } catch {
      // WebGPU availability does not guarantee that every model operator works.
    }
  }

  return {
    backend: 'wasm',
    translate: await pipeline('translation', modelId, {
      ...modelOptions,
      device: 'wasm',
    }),
  };
}
