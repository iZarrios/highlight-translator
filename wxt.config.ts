import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Highlight Translator',
    description:
      'Translate highlighted text on-device and explain it with your chosen AI.',
    minimum_chrome_version: '138',
    permissions: ['activeTab', 'offscreen', 'storage', 'sidePanel'],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Open translation history',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      'toggle-lookup': {
        suggested_key: {
          default: 'Alt+Shift+L',
          mac: 'MacCtrl+Shift+L',
        },
        description: 'Look up the current selection',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: {
    chromiumArgs: ['--disable-features=DisableLoadExtensionCommandLineSwitch'],
  },
});
