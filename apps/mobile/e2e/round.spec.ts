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

async function dismissDevOverlay(page: Page) {
  await page.evaluate(() => {
    const hide = () => {
      document.getElementById('error-toast')?.remove();
      for (const node of document.querySelectorAll('button, [role="button"]')) {
        const text = node.textContent ?? '';
        if (!text.includes('non-boolean') && !text.includes('Unknown event handler')) continue;
        node.remove();
      }
    };
    const flag = window as unknown as { __cooprHideLog?: boolean };
    if (!flag.__cooprHideLog) {
      flag.__cooprHideLog = true;
      new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
    hide();
  });
}

test('plays 18 holes with the buttons on screen', async ({ page }) => {
  test.setTimeout(360000);
  await page.addInitScript(() => {
    const hide = () => {
      document.getElementById('error-toast')?.remove();
      for (const node of document.querySelectorAll('button, [role="button"]')) {
        const text = node.textContent ?? '';
        if (text.includes('Unknown event handler') || text.includes('non-boolean')) node.remove();
      }
    };
    const style = document.createElement('style');
    style.textContent = '#error-toast, #error-toast * { display: none !important; pointer-events: none !important; }';
    document.documentElement.appendChild(style);
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
    hide();
  });
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await page.goto('/');
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Tee off' }).click({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
  await shot(page, 'home');
  await page.getByRole('button', { name: 'Show more' }).click();

  await expect(page.getByRole('button', { name: 'Past rounds' })).toBeVisible();
  await page.getByRole('button', { name: /Bag,/ }).click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('button', { name: 'ADD IT FAST' }).click();
  const iron = await page.getByRole('button', { name: '7 iron', exact: true }).boundingBox();
  const addClub = await page.getByRole('button', { name: 'Add club' }).boundingBox();
  expect(iron, '7 iron chip').toBeTruthy();
  expect(addClub, 'Add club').toBeTruthy();
  expect(iron!.y).toBeLessThan(addClub!.y);
  expect(addClub!.y + addClub!.height).toBeLessThanOrEqual(viewport.height);
  expect(iron!.y + iron!.height).toBeLessThanOrEqual(viewport.height);
  await shot(page, 'quick');
  await page.getByRole('button', { name: 'Titleist', exact: true }).click();
  await page.getByRole('button', { name: 'Model GT2' }).click();
  await page.getByRole('button', { name: '7 iron', exact: true }).click();
  await page.getByRole('button', { name: 'Add club' }).click();
  await expect(page.getByText('7 iron').first()).toBeVisible();
  await page.getByRole('button', { name: 'Use a starter bag' }).click();
  await expect(page.getByText('Starter').first()).toBeVisible();
  const starterCount = await page.getByTestId('starter-club').count();
  expect(starterCount).toBeGreaterThan(0);
  for (let index = 0; index < starterCount; index += 1) {
    const text = await page.getByTestId('starter-club').nth(index).innerText();
    expect(text, 'starter card').not.toMatch(/Name not set|Can't tell yet/);
  }
  await shot(page, 'bag');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByTestId('coach-sheet')).toBeVisible();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    if (!raw) return false;
    try {
      return JSON.parse(raw).inProgress === true;
    } catch {
      return false;
    }
  });
  await page.reload();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /RESUME ROUND/ })).toBeVisible();
  await page.getByRole('button', { name: /RESUME ROUND/ }).click();
  await expect(page.getByTestId('hole-pill')).toBeVisible();
  await page.waitForTimeout(1200);
  const holeBeforePan = await page.getByTestId('hole-pill').innerText();
  const transformBefore = await page.getByTestId('hole-map').evaluate((el) => getComputedStyle(el).transform);
  const map = await page.getByTestId('hole-map').boundingBox();
  expect(map).toBeTruthy();
  const dragX = map!.x + map!.width / 2;
  const dragY = Math.min(map!.y + 220, viewport.height * 0.4);
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX + 80, dragY + 36, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => page.getByTestId('map-pan').getAttribute('data-offset'), { timeout: 3000 }).not.toBe('0,0');
  await expect(page.getByText('0,0', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByText('0,0', { exact: true })).toHaveCount(0);
  const transformAfter = await page.getByTestId('hole-map').evaluate((el) => getComputedStyle(el).transform);
  expect(transformAfter).not.toBe(transformBefore);
  expect(await page.getByTestId('hole-pill').innerText()).toBe(holeBeforePan);
  await shot(page, 'map');
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

  await dismissDevOverlay(page);
  await page.getByTestId('mark-shot').click();
  await expect(page.getByTestId('marked-toast')).toBeVisible();
  const covered = await page.evaluate(() => {
    const toast = document.querySelector('[data-testid="marked-toast"]');
    if (!toast) return true;
    const box = toast.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + Math.min(box.height / 2, 20));
    return hit != null && !toast.contains(hit);
  });
  expect(covered).toBe(false);
  const toastBox = boxOf(await page.getByTestId('marked-toast').boundingBox());
  expect(toastBox, 'toast').toBeTruthy();
  expect(overlaps(toastBox!, plate!)).toBe(false);
  await shot(page, 'marked');
  await expect(page.getByTestId('marked-toast')).toBeHidden({ timeout: 3000 });

  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Ask COOPR' }).click();
  await page.getByLabel('Typed ask').fill('What club from here?');
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByTestId('caddie-answer')).toBeVisible();
  const answer = await page.getByTestId('caddie-answer').boundingBox();
  expect(answer!.height).toBeLessThanOrEqual(130);
  const typed = await page.getByLabel('Typed ask').boundingBox();
  expect(typed!.y + typed!.height).toBeLessThanOrEqual(viewport.height);
  await shot(page, 'ask');
  await page.getByRole('button', { name: 'Hide coach' }).click();

  await page.getByRole('button', { name: 'Score', exact: true }).click();
  await expect(page.getByLabel('Penalties 0')).toBeVisible();
  const panel = boxOf(await page.getByTestId('score-entry').boundingBox());
  const save = boxOf(await page.getByRole('button', { name: 'Save and next hole' }).boundingBox());
  const penalties = boxOf(await page.getByText('Penalties', { exact: true }).boundingBox());
  expect(panel).toBeTruthy();
  expect(save).toBeTruthy();
  expect(penalties).toBeTruthy();
  expect(save!.y).toBeGreaterThanOrEqual(0);
  expect(save!.y + save!.h).toBeLessThanOrEqual(viewport.height + 1);
  expect(save!.y + save!.h).toBeLessThanOrEqual(panel!.y + panel!.h + 1);
  expect(Math.abs(panel!.y + panel!.h - (save!.y + save!.h))).toBeLessThanOrEqual(16);
  const shortPhone = viewport.height <= 700;
  if (!shortPhone) expect(penalties!.y + penalties!.h).toBeLessThanOrEqual(viewport.height + 1);
  const landscape = viewport.width > viewport.height;
  if (!landscape) expect(overlaps(panel!, plate!)).toBe(false);
  else {
    const fieldHeight = await page.getByTestId('score-fields').evaluate((el) => el.clientHeight);
    expect(fieldHeight).toBeGreaterThanOrEqual(140);
  }
  const fieldSlack = await page.getByTestId('score-fields').evaluate((el) => el.scrollHeight - el.clientHeight);
  if (!shortPhone) expect(fieldSlack).toBeLessThanOrEqual(viewport.height < 800 ? 40 : 1);
  for (let extra = 0; extra < 8; extra += 1) await page.getByRole('button', { name: 'More putts entry' }).click();
  const puttValue = Number(await page.getByLabel(/^Putts \d+$/).innerText());
  const strokeValue = Number(await page.getByLabel(/^Strokes \d+$/).evaluateAll((nodes) => {
    const digits = nodes.map((node) => (node.textContent ?? '').trim()).find((text) => /^\d+$/.test(text));
    return digits ?? '0';
  }));
  expect(puttValue).toBeLessThanOrEqual(strokeValue);
  expect(puttValue).toBeGreaterThan(0);
  await shot(page, 'score');
  await page.getByRole('button', { name: 'Close score' }).click();
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByText(/End the round\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('button', { name: 'Pause round (keep progress)' })).toBeHidden();
  await page.getByRole('button', { name: 'Score', exact: true }).click();
  const advance = page.getByRole('button', { name: 'Save and next hole' });
  if (await advance.isVisible()) await advance.click();
  else await page.getByRole('button', { name: 'Finish round' }).click();
  await page.getByRole('button', { name: 'Previous hole', exact: true }).click();
  await page.getByRole('button', { name: 'Next hole', exact: true }).click();
  await expect(page.getByTestId('thru-label')).toBeVisible();
  const thru = boxOf(await page.getByTestId('thru-label').boundingBox());
  const coach = boxOf(await page.getByTestId('coach-sheet').boundingBox());
  expect(thru).toBeTruthy();
  expect(coach).toBeTruthy();
  expect(overlaps(thru!, coach!)).toBe(false);
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'End round' }).click();
  await page.getByRole('button', { name: 'Confirm end round' }).click();
  await expect(page.getByText('Round recap').filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText(/Gross /).filter({ visible: true }).last()).toBeVisible();
  await shot(page, 'early-recap');
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Past rounds' }).click();
  await expect(page.getByText('No rounds yet. Your first one lands here.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask COOPR' })).toHaveCount(0);
  const roundsBack = boxOf(await page.getByRole('button', { name: 'Back' }).boundingBox());
  expect(roundsBack!.w).toBeLessThan(220);
  await shot(page, 'rounds');
  await page.getByRole('button', { name: /Gross / }).first().click();
  await expect(page.getByText('Round recap').filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText(/Putts /).filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText(/Fairways /).filter({ visible: true }).last()).toBeVisible();
  await shot(page, 'round');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show more' }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Past rounds' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByTestId('coach-sheet')).toBeVisible();
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Pause round (keep progress)' }).click();
  await expect(page.getByRole('button', { name: /RESUME ROUND/ })).toBeVisible();
  await page.getByRole('button', { name: /RESUME ROUND/ }).click();

  for (let step = 0; step < 18; step += 1) {
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    const finish = page.getByRole('button', { name: 'Finish round' });
    if (await finish.isVisible()) {
      await expect(page.getByRole('button', { name: 'Score next hole' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Next hole', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeVisible();
      await finish.click();
      break;
    }
    await page.getByRole('button', { name: 'Save and next hole' }).click();
  }
  await expect(page.getByText('Round recap').filter({ visible: true }).last()).toBeVisible();
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Past rounds' }).click();
  await expect(page.getByText('No rounds yet. Your first one lands here.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Gross / }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await shot(page, 'recap');
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
});
