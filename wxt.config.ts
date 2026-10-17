import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Highlight Translator',
    description:
      'Translate and explain highlighted text with your chosen AI provider.',
    minimum_chrome_version: '138',
    permissions: ['activeTab', 'storage', 'sidePanel'],
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
