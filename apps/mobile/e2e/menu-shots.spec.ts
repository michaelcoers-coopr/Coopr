import { expect, test, type Page } from '@playwright/test';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

async function inside(page: Page, name: string) {
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, name).toBeTruthy();
  expect(box!.y, name).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height, name).toBeLessThanOrEqual(viewport.height + 1);
  expect(box!.height, name).toBeGreaterThanOrEqual(44);
}

test('fifteen shots keep the round menu controls on screen', async ({ page }) => {
  test.setTimeout(120000);
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
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible({ timeout: 30000 });
  const handicap = page.getByLabel('Handicap, your entry');
  await handicap.scrollIntoViewIfNeeded();
  const handicapBox = await handicap.boundingBox();
  const saveBox = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
  expect(handicapBox && saveBox).toBeTruthy();
  expect(overlaps(handicapBox!, saveBox!)).toBe(false);
  expect(handicapBox!.y + handicapBox!.height).toBeLessThanOrEqual(saveBox!.y + 1);
  await page.getByRole('button', { name: 'Use a starter bag' }).click();
  await page.getByRole('button', { name: 'Show more' }).click();
  await page.getByRole('button', { name: /Bag,/ }).click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('button', { name: 'ADD IT FAST' }).click();
  const brand = page.getByRole('button', { name: 'Titleist', exact: true });
  await brand.scrollIntoViewIfNeeded();
  const brandBox = await brand.boundingBox();
  const addBox = await page.getByRole('button', { name: 'Add club', exact: true }).boundingBox();
  expect(brandBox && addBox).toBeTruthy();
  expect(overlaps(brandBox!, addBox!)).toBe(false);
  expect(brandBox!.y + brandBox!.height).toBeLessThanOrEqual(addBox!.y + 1);
  await page.goto('/');
  await page.getByRole('button', { name: /START ROUND|RESUME ROUND/ }).click();
  await expect(page.getByTestId('mark-shot')).toBeVisible();
  await page.waitForFunction(() => !!localStorage.getItem('coopr.round.v1'));
  const marks = [1, 2, 3].flatMap((hole) => Array.from({ length: 15 }, (_, index) => ({
    id: `mark-${hole}-${index + 1}`,
    hole,
    lat: 47.1123,
    lon: -122.2372,
    clubId: 'starter-driver',
    clubLabel: 'Driver',
    yards: 120 + index,
    lie: 'fairway',
  })));
  await page.addInitScript((payload) => {
    const raw = localStorage.getItem('coopr.round.v1');
    if (!raw) return;
    try {
      const save = JSON.parse(raw) as { marks?: unknown[]; currentHole?: number; inProgress?: boolean };
      save.marks = payload;
      save.currentHole = 1;
      save.inProgress = true;
      localStorage.setItem('coopr.round.v1', JSON.stringify(save));
    } catch {
      /* The round file can be mid-write. The next load tries again. */
    }
  }, marks);
  await page.reload();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    if (!raw) return false;
    try {
      return JSON.parse(raw).marks?.length === 45;
    } catch {
      return false;
    }
  });
  await expect(page.getByTestId('round-menu')).toBeVisible({ timeout: 30000 });
  const speech = page.getByTestId('caddie-speech');
  await expect(speech).toHaveAttribute('aria-hidden', 'true');
  if (viewport.width > viewport.height) {
    const panel = page.getByTestId('club-chip-panel');
    if (await panel.count()) {
      const background = await panel.evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(background).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    }
  }
  await page.getByTestId('round-menu').click();
  await expect(page.getByTestId('hole-shot')).toHaveCount(15);
  const list = page.getByTestId('shot-list');
  const scrolls = await list.evaluate((node) => node.scrollHeight > node.clientHeight + 4);
  expect(scrolls).toBe(true);
  for (const name of ['Pause round (keep progress)', 'Mute caddie', 'Hands-free off', 'End round']) {
    await inside(page, name);
  }
  await page.getByTestId('reassign-shot').first().scrollIntoViewIfNeeded();
  await page.getByTestId('reassign-shot').first().click();
  await expect(page.getByTestId('hole-shot').first()).not.toContainText('Driver');
});
