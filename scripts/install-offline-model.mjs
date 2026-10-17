import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const TRANSFORMERS_VERSION = '4.3.1';
const ONNX_RUNTIME_VERSION = '1.31.0-dev.20260914-8d85527a0';
const MODEL_REPOSITORY = 'onnx-community/opus-mt-mul-en';
const MODEL_REVISION = 'caca514947aca3bc7e83e6ff1cc459fea224c728';
const runtimeOnly = process.argv.includes('--runtime-only');

const projectRoot = path.resolve(import.meta.dirname, '..');
const offlineRoot = path.join(projectRoot, 'public', 'offline');
const wasmRoot = path.join(offlineRoot, 'wasm');
const modelRoot = path.join(
  projectRoot,
  'public',
  'offline-models',
  ...MODEL_REPOSITORY.split('/'),
);

const modelFiles = [
  'config.json',
  'generation_config.json',
  'quantize_config.json',
  'source.spm',
  'special_tokens_map.json',
  'target.spm',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'onnx/encoder_model_q4.onnx',
  'onnx/decoder_model_merged_q4.onnx',
];

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const partialDestination = `${destination}.part`;
  process.stdout.write(
    `Downloading ${path.relative(projectRoot, destination)}\n`,
  );
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(partialDestination),
    );
    await rename(partialDestination, destination);
  } catch (error) {
    await rm(partialDestination, { force: true });
    throw error;
  }
}

await mkdir(wasmRoot, { recursive: true });
if (!runtimeOnly) {
  await mkdir(modelRoot, { recursive: true });
  await download(
    `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`,
    path.join(offlineRoot, 'transformers.min.js'),
  );
}

const runtimeMetadataUrl = `https://unpkg.com/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/?meta`;
const runtimeMetadataResponse = await fetch(runtimeMetadataUrl);
if (!runtimeMetadataResponse.ok) {
  throw new Error(
    `Could not list ONNX Runtime assets (${runtimeMetadataResponse.status}).`,
  );
}
const runtimeMetadata = await runtimeMetadataResponse.json();
const runtimeFiles = runtimeMetadata.files.filter(
  ({ path: filePath }) =>
    filePath.endsWith('.wasm') || filePath.endsWith('.mjs'),
);
if (runtimeFiles.length === 0) {
  throw new Error('The ONNX Runtime package did not contain browser assets.');
}
for (const file of runtimeFiles) {
  const filename = path.basename(file.path);
  await download(
    `https://unpkg.com/onnxruntime-web@${ONNX_RUNTIME_VERSION}${file.path}`,
    path.join(wasmRoot, filename),
  );
}

if (!runtimeOnly) {
  for (const file of modelFiles) {
    const encodedFile = file.split('/').map(encodeURIComponent).join('/');
    await download(
      `https://huggingface.co/${MODEL_REPOSITORY}/resolve/${MODEL_REVISION}/${encodedFile}?download=true`,
      path.join(modelRoot, file),
    );
  }

  await writeFile(
    path.join(projectRoot, 'public', 'offline-models', 'NOTICE.txt'),
    [
      `Model: ${MODEL_REPOSITORY}@${MODEL_REVISION}`,
      'Base model: Helsinki-NLP/opus-mt-mul-en',
      'Model license: CC BY 4.0',
      `Transformers.js ${TRANSFORMERS_VERSION}: Apache-2.0`,
      `ONNX Runtime Web ${ONNX_RUNTIME_VERSION}: MIT`,
      '',
    ].join('\n'),
  );
}

process.stdout.write(
  'Offline translation runtime installed. Run pnpm build or restart pnpm dev.\n',
);
