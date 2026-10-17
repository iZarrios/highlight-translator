import { expect, test } from '@playwright/test';

test('real Chrome exposes its on-device translation interfaces', async ({
  page,
}) => {
  test.skip(
    process.env.RUN_CHROME_AI !== '1',
    'Requires Chrome with downloaded AI language packs.',
  );
  await page.goto('http://127.0.0.1:4173/');
  const support = await page.evaluate(() => ({
    translator: 'Translator' in globalThis,
    detector: 'LanguageDetector' in globalThis,
  }));
  expect(support).toEqual({ translator: true, detector: true });
});
