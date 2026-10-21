import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import '@/ui/base.css';
import { useLookupStore } from '@/lookup-store';
import { readSelection } from '@/read-selection';
import { LookupCard } from '@/ui/entrypoints/highlight.content/lookup-card';

const SELECTION_DELAY_MS = 250;
const MODIFIER_KEYS = new Set(['Alt', 'AltGraph', 'Control', 'Meta']);

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'highlight-translator',
      position: 'overlay',
      isolateEvents: true,
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<LookupCard />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();

    let timer: number | undefined;
    const showSelection = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const selection = readSelection();
        if (selection) useLookupStore.getState().show(selection);
        else useLookupStore.getState().close();
      }, SELECTION_DELAY_MS);
    };

    ctx.addEventListener(document, 'pointerup', (event) => {
      // Clicks and selections inside the card must not replace the lookup.
      if (event.composedPath().includes(ui.shadowHost)) return;
      showSelection();
    });
    ctx.addEventListener(document, 'keyup', (event) => {
      if (event.key === 'Escape') useLookupStore.getState().close();
      else if (!MODIFIER_KEYS.has(event.key)) showSelection();
    });
    browser.runtime.onMessage.addListener((message: unknown) => {
      if ((message as { type?: string })?.type === 'selection:lookup')
        showSelection();
    });
  },
});
