# Highlight Translator

A local-first Chromium extension that translates highlighted text to English with Chrome's on-device Translator API and explains it with any OpenAI-compatible server.

## Features

- On-device language detection and translation in supported Chromium browsers
- Ollama, llama.cpp, OpenAI, LAN, and custom OpenAI-compatible endpoints
- Optional streaming explanations
- Shadow DOM lookup card isolated from page styles
- Searchable local history in the Chromium side panel
- Runtime host permissions requested only for endpoints you add
- API keys remain in extension-local storage and never enter the content script

## Development

Requirements: Node.js 24+, Corepack, and a Chromium-based browser.

```bash
corepack enable
pnpm install
pnpm test:install
pnpm dev
```

Build and package:

```bash
pnpm build
pnpm zip
```

## Testing

```bash
pnpm test:unit
pnpm test:e2e
pnpm test:e2e:headed
pnpm check
```

The Playwright suite installs and launches a pinned Chromium build with the unpacked production extension. It uses local fixture pages and a deterministic OpenAI-compatible test server; no live model or internet connection is required after dependencies and Chromium are installed.

The real Chrome Translator API depends on Chrome-managed language packs, which are not guaranteed to exist in Playwright Chromium. Run its explicit smoke test from a Chrome installation with the required packs:

```bash
RUN_CHROME_AI=1 pnpm test:chrome-ai
```

## Local model servers

Ollama:

```bash
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

Then add `http://127.0.0.1:11434/v1` in the extension settings.

llama.cpp:

```bash
llama-server --model /path/to/model.gguf --host 127.0.0.1 --port 8080
```

Then add `http://127.0.0.1:8080/v1`.

## Fully offline translation

Install the pinned multilingual OPUS-MT model, Transformers.js runtime, and ONNX
WebGPU/WASM runtime files into the extension before building:

```bash
pnpm offline:model:install
pnpm build
```

To repair or refresh only the smaller ONNX runtime files without downloading the
model again:

```bash
pnpm offline:runtime:install
pnpm build
```

The download is a few hundred megabytes. Runtime model loading is restricted to
these packaged files: highlighted text is not sent to Hugging Face or another
translation service. Select **Offline WASM only** in Options to prohibit
translation fallback to the configured AI provider, or use **Automatic** to try
Chrome's built-in engine, packaged WebGPU/WASM runtime, and then the active
provider.

For a stable extension ID, replace the wildcard Ollama origin with the installed extension's exact `chrome-extension://<id>` origin.

## Privacy model

Translation inference runs through Chromium's local Translator API. The highlighted text and a bounded nearby context window are sent only to the explanation provider selected in settings. There is no automatic cloud fallback. History is stored in extension-origin IndexedDB and browser sync is not used. Saving source page titles and URLs is disabled by default.
