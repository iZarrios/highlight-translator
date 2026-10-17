import { expect, test } from '@@/tests/e2e/extension-fixture';

test.beforeEach(async ({ context, extensionId }) => {
  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/options.html`);
  const response = await extensionPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: 'settings:set',
      settings: {
        providers: [
          {
            id: 'fixture-provider',
            name: 'Test provider',
            baseUrl: 'http://127.0.0.1:4173/v1',
            model: 'fixture-model',
            enabled: true,
            originPermission: 'http://127.0.0.1:4173/*',
          },
        ],
        activeProviderId: 'fixture-provider',
        streamResults: true,
        historyEnabled: false,
        savePageDetails: false,
        retentionLimit: 100,
      },
    }),
  );
  expect(response).toMatchObject({ ok: true });
  await extensionPage.close();
});

test('highlighting page text opens an isolated lookup card', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');

  await page.locator('#idiom').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });

  const card = page.getByRole('dialog', {
    name: 'Translation and explanation',
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText('once in a blue moon');
  await expect(card).toContainText('Translation · This device · Test provider');
  await expect(card).toContainText('A deterministic translation.');
  await expect(card).toContainText('Explanation · This device · Test provider');
  await expect(card).toContainText('A deterministic test explanation.');
});

test('Escape closes the lookup card', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#french').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });

  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
