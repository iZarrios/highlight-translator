import { expect, test } from '@@/tests/e2e/extension-fixture';

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
  await expect(card).toContainText('Translation · Configured AI');
  await expect(card).toContainText('A deterministic translation.');
  await expect(card).toContainText('Explanation · Configured AI');
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
