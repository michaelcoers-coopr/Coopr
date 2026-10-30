import { expect, test } from '@playwright/test';

test('More is grouped and Past rounds is the filled action', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const sweep = () => {
      const toast = document.getElementById('error-toast');
      if (!toast) return;
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    };
    setInterval(sweep, 100);
  });
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await page.goto('/');
  await page.getByRole('button', { name: 'Tee off' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await expect(page.getByTestId('home-sheet-level')).toHaveAttribute('data-level', /half|full/);
  const more = page.getByRole('button', { name: 'More', exact: true });
  await more.scrollIntoViewIfNeeded();
  await more.click({ force: true });
  for (const heading of ['Round', 'Practice', 'Caddie', 'About']) {
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
  }
  const past = page.getByRole('button', { name: 'Past rounds' });
  await past.scrollIntoViewIfNeeded();
  const box = await past.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  const fill = await past.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(fill).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
});
