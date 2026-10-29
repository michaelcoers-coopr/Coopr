import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shots = join(process.cwd(), 'apps/mobile/e2e/screenshots');
mkdirSync(shots, { recursive: true });

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  await page.screenshot({ path: join(shots, `${project}-${name}.png`), fullPage: false });
}

async function visibleButtons(page: Page) {
  return page.locator('[role="button"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        name: node.getAttribute('aria-label') || (node.textContent ?? '').trim(),
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
        shown: box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      };
    }),
  );
}

function boxOf(raw: { x: number; y: number; width: number; height: number } | null) {
  if (!raw) return null;
  return { x: raw.x, y: raw.y, w: raw.width, h: raw.height };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

test('plays 18 holes with the buttons on screen', async ({ page }) => {
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
  await shot(page, 'home');

  await page.getByRole('button', { name: /Bag,/ }).click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('button', { name: 'ADD IT FAST' }).click();
  await page.getByRole('button', { name: 'Titleist', exact: true }).click();
  await page.getByRole('button', { name: 'Model GT2' }).click();
  await page.getByRole('button', { name: '7 iron', exact: true }).click();
  await page.getByRole('button', { name: 'Add club' }).click();
  await expect(page.getByText('7 iron').first()).toBeVisible();
  await page.getByRole('button', { name: 'Use a starter bag' }).click();
  await expect(page.getByText('Starter').first()).toBeVisible();
  await shot(page, 'bag');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByTestId('coach-sheet')).toBeVisible();
  const sheet = await page.getByTestId('coach-sheet').boundingBox();
  expect(sheet).toBeTruthy();
  expect(sheet!.height / viewport.height).toBeLessThanOrEqual(0.2);
  const pill = boxOf(await page.getByTestId('hole-pill').boundingBox());
  const plate = boxOf(await page.getByText('YARDS TO GREEN').locator('xpath=..').boundingBox());
  expect(pill, 'hole pill').toBeTruthy();
  expect(plate, 'yardage plate').toBeTruthy();
  expect(overlaps(pill!, plate!)).toBe(false);
  expect(pill!.y).toBeGreaterThanOrEqual(0);
  expect(plate!.y).toBeGreaterThanOrEqual(0);
  expect(pill!.x).toBeGreaterThanOrEqual(0);
  expect(plate!.x + plate!.w).toBeLessThanOrEqual(viewport.width + 1);
  await shot(page, 'hole');

  const taps = await visibleButtons(page);
  for (const button of taps) {
    if (!button.shown) continue;
    if (button.y > viewport.height || button.y + button.h < 0) continue;
    if (button.x > viewport.width || button.x + button.w < 0) continue;
    expect(Math.round(button.h), button.name).toBeGreaterThanOrEqual(44);
    expect(Math.round(button.w), button.name).toBeGreaterThanOrEqual(44);
  }

  await page.getByTestId('mark-shot').click();
  await expect(page.getByTestId('marked-toast')).toBeVisible();
  await shot(page, 'marked');
  await expect(page.getByTestId('marked-toast')).toBeHidden({ timeout: 3000 });

  await page.getByRole('button', { name: 'Score', exact: true }).click();
  await shot(page, 'score');
  const advance = page.getByRole('button', { name: 'Save and next hole' });
  if (await advance.isVisible()) await advance.click();
  else await page.getByRole('button', { name: 'Finish round' }).click();
  await page.getByRole('button', { name: 'Previous hole', exact: true }).click();
  await page.getByRole('button', { name: 'Next hole', exact: true }).click();
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Pause round (keep progress)' }).click();
  await expect(page.getByRole('button', { name: /RESUME ROUND/ })).toBeVisible();
  await page.getByRole('button', { name: /RESUME ROUND/ }).click();

  for (let step = 0; step < 18; step += 1) {
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    const finish = page.getByRole('button', { name: 'Finish round' });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    await page.getByRole('button', { name: 'Save and next hole' }).click();
  }
  await expect(page.getByText('Round recap')).toBeVisible();
  await shot(page, 'recap');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
});
