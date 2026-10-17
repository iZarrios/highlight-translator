# Highlight Translator

A Chromium extension that translates highlighted text into English and gives a
short contextual explanation using an OpenAI-compatible AI provider. One
structured request produces both results.

## Features

- Translation and explanation in one JSON Schema-constrained request
- Ollama, llama.cpp, OpenAI, LAN, and custom OpenAI-compatible endpoints
- Optional streaming with independently rendered translation and explanation
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

Load `.output/chrome-mv3-dev` when running `pnpm dev`, and keep that process
running so WXT rebuilds it as files change. For a one-shot rebuild of that same
development directory, run `pnpm build:dev`. If Brave is instead loaded from
`.output/chrome-mv3`, update it with `pnpm build`.

## Testing

```bash
pnpm test:unit
pnpm test:e2e
pnpm test:e2e:headed
pnpm check
```

The Playwright suite installs and launches a pinned Chromium build with the
unpacked production extension. It uses local fixture pages and a deterministic
OpenAI-compatible test server; no live model or internet connection is required
after dependencies and Chromium are installed.

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

The selected server must implement OpenAI-compatible Chat Completions and
support `response_format` with `json_schema`. For a stable extension ID, replace
the wildcard Ollama origin with the installed extension's exact
`chrome-extension://<id>` origin.

## Privacy model

The highlighted text and a bounded nearby context window are sent only to the
provider selected in settings. That provider may run on the same device, on the
local network, or remotely; the lookup card identifies its location. There is
no automatic fallback to another provider.

History is stored in extension-local IndexedDB without browser sync. Saving
page titles and URLs is disabled by default.
