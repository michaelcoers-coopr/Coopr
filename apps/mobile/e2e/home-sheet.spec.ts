import { expect, test, type Page } from '@playwright/test';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

async function box(page: Page, name: string | RegExp) {
  const locator = page.getByRole('button', { name }).first();
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const raw = await locator.boundingBox();
  expect(raw, String(name)).toBeTruthy();
  return { locator, raw: raw! };
}

test('the course map stays clear and the round sheet keeps start in reach', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'START ROUND' })).toBeVisible();
  await expect(page.getByText(/USDA NAIP/)).toHaveCount(0);
  await expect(page.getByText('TEE IT UP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Past rounds' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Games' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask caddie' })).toHaveCount(0);

  const start = await box(page, 'START ROUND');
  expect(start.raw.height).toBeGreaterThanOrEqual(56);
  expect(start.raw.y).toBeGreaterThanOrEqual(-1);
  expect(start.raw.y + start.raw.height).toBeLessThanOrEqual(viewport.height + 1);
  const pill = await page.getByTestId('course-pill').boundingBox();
  const credit = await box(page, 'Map credit');
  expect(pill).toBeTruthy();
  expect(overlaps(start.raw, pill!)).toBe(false);
  expect(overlaps(credit.raw, pill!)).toBe(false);
  expect(credit.raw.width).toBeGreaterThanOrEqual(44);
  expect(credit.raw.height).toBeGreaterThanOrEqual(44);

  await credit.locator.click();
  await expect(page.getByTestId('map-credit-panel')).toContainText('USDA NAIP');
  await expect(page.getByTestId('map-credit-panel')).toContainText('OpenStreetMap');
  await page.getByRole('button', { name: 'Close map credit' }).click();
  await expect(page.getByText(/USDA NAIP/)).toHaveCount(0);

  const handle = await page.getByTestId('home-sheet-handle').boundingBox();
  expect(handle).toBeTruthy();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2, Math.max(8, handle!.y - 180), { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('home-sheet-level')).toHaveAttribute('data-level', /half|full/);

  const startAfter = await box(page, 'START ROUND');
  for (const name of ['Games', 'Ask caddie', 'Past rounds', /Bag,/]) {
    const item = await box(page, name);
    expect(item.raw.height).toBeGreaterThanOrEqual(44);
    expect(item.raw.y).toBeGreaterThanOrEqual(-1);
    expect(item.raw.y + item.raw.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(overlaps(item.raw, startAfter.raw)).toBe(false);
  }
});
