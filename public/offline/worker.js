import { createTranslationPipeline } from './backend-selector.js';
import { env, pipeline } from './transformers.min.js';

const MODEL_ID = 'onnx-community/opus-mt-mul-en';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = new URL('../offline-models/', import.meta.url).href;
env.backends.onnx.wasm.wasmPaths = new URL('./wasm/', import.meta.url).href;

let translatorPromise;

function translator(progressCallback) {
  translatorPromise ??= createTranslationPipeline({
    pipeline,
    modelId: MODEL_ID,
    modelOptions: {
      dtype: 'q4',
      progress_callback: progressCallback,
    },
    supportsWebGpu: 'gpu' in navigator,
  });
  return translatorPromise;
}

self.addEventListener('message', async (event) => {
  const { id, text } = event.data;
  try {
    const { backend, translate } = await translator((progress) => {
      if (typeof progress.progress !== 'number') return;
      self.postMessage({
        type: 'progress',
        id,
        loaded: progress.progress,
        total: 100,
      });
    });
    const output = await translate(text, { num_beams: 1 });
    const translatedText = output?.[0]?.translation_text;
    if (typeof translatedText !== 'string' || !translatedText.trim()) {
      throw new Error('The offline model returned an empty translation.');
    }
    self.postMessage({
      type: 'result',
      id,
      backend,
      translatedText: translatedText.trim(),
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
