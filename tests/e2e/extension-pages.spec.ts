import { expect, test } from '@@/tests/e2e/extension-fixture';

test('settings page exposes provider and privacy controls', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(
    page.getByRole('heading', { name: 'Highlight Translator' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'AI providers' }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /Stream AI results/ }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: /Save page title and URL/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Load models' })).toBeVisible();
  await expect(page.getByLabel('Model')).toHaveAttribute(
    'placeholder',
    /Select Load models/,
  );
});

test('side panel renders local history controls', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(
    page.getByRole('heading', { name: 'Lookup history' }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder('Search highlights and explanations'),
  ).toBeVisible();
  await expect(page.getByText('local only')).toBeVisible();
});
