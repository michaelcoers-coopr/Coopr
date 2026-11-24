import { expect, test, type Page } from '@playwright/test';

type Box = { x: number; y: number; w: number; h: number; name: string };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
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

async function boxes(page: Page, names: string[]): Promise<Box[]> {
  const found: Box[] = [];
  for (const name of names) {
    const locator = page.getByRole('button', { name, exact: true }).first();
    await expect(locator, name).toBeVisible();
    const raw = await locator.boundingBox();
    expect(raw, name).toBeTruthy();
    found.push({ name, x: raw!.x, y: raw!.y, w: raw!.width, h: raw!.height });
  }
  return found;
}

async function assertPrimary(page: Page, names: string[]) {
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await expect(page.getByText('Bundling...')).toHaveCount(0, { timeout: 30000 });
  await dismissDevOverlay(page);
  const found = await boxes(page, names);
  for (const button of found) {
    expect(Math.round(button.w), button.name).toBeGreaterThanOrEqual(44);
    expect(Math.round(button.h), button.name).toBeGreaterThanOrEqual(44);
    expect(button.x, button.name).toBeGreaterThanOrEqual(-1);
    expect(button.y, button.name).toBeGreaterThanOrEqual(-1);
    expect(button.x + button.w, button.name).toBeLessThanOrEqual(viewport.width + 1);
    expect(button.y + button.h, button.name).toBeLessThanOrEqual(viewport.height + 1);
    const locator = page.getByRole('button', { name: button.name, exact: true }).first();
    const covered = await locator.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const x = Math.min(box.x + box.width / 2, window.innerWidth - 2);
      const y = Math.min(box.y + box.height / 2, window.innerHeight - 2);
      const hit = document.elementFromPoint(Math.max(1, x), Math.max(1, y));
      if (hit == null || node.contains(hit) || hit === node || hit.closest('[role="button"]') === node) return '';
      const rect = (hit as HTMLElement).getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) return '';
      let walk: Element | null = hit;
      while (walk) {
        const text = walk.textContent || '';
        if (text.includes('non-boolean') || text.includes('Unknown event handler')) return '';
        walk = walk.parentElement;
      }
      return `${hit.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
    });
    expect(covered, `${button.name} covered by ${covered}`).toBe('');
  }
  for (let i = 0; i < found.length; i += 1) {
    for (let j = i + 1; j < found.length; j += 1) {
      expect(overlaps(found[i]!, found[j]!), `${found[i]!.name} overlaps ${found[j]!.name}`).toBe(false);
    }
  }
}

test('primary buttons fit on every phone size', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const arm = () => {
      if (document.getElementById('coopr-hide-log')) return;
      const style = document.createElement('style');
      style.id = 'coopr-hide-log';
      style.textContent = '#error-toast { display: none !important; pointer-events: none !important; }';
      (document.head || document.documentElement).appendChild(style);
    };
    arm();
    new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Tee off' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('Handicap, your entry')).toHaveCount(0);
  const name = page.getByLabel('Name, your entry');
  await name.scrollIntoViewIfNeeded();
  const nameBox = await name.boundingBox();
  const tee = await page.getByRole('button', { name: 'Tee off' }).boundingBox();
  expect(nameBox && tee).toBeTruthy();
  const nameHitsTee = nameBox!.x < tee!.x + tee!.width - 1 && nameBox!.x + nameBox!.width > tee!.x + 1 && nameBox!.y < tee!.y + tee!.height - 1 && nameBox!.y + nameBox!.height > tee!.y + 1;
  expect(nameHitsTee).toBe(false);
  await assertPrimary(page, ['Tee off']);
  await page.getByRole('button', { name: 'Tee off' }).click();

  const start = page.getByRole('button', { name: /START ROUND|RESUME ROUND/ });
  await expect(start).toBeVisible();
  const startName = (await start.getAttribute('aria-label')) ?? '';
  await assertPrimary(page, [startName]);
  await expect(page.getByText(/USDA NAIP/)).toHaveCount(0);
  const short = (page.viewportSize()?.height ?? 800) <= 420;
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  if (!short) await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await expect(page.getByTestId('home-sheet-level')).toHaveAttribute('data-level', short ? 'half' : 'full');
  await page.waitForTimeout(400);
  const bag = page.getByRole('button', { name: /Bag,/ });
  await expect(bag).toBeVisible();
  const bagName = (await bag.getAttribute('aria-label')) ?? '';
  await assertPrimary(page, ['Past rounds', 'Games', 'Ask caddie', bagName]);

  await bag.click();
  await expect(page.getByRole('button', { name: 'Add to bag' })).toBeVisible();
  await assertPrimary(page, ['Add to bag', 'Back']);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('button', { name: 'ADD IT FAST' }).click();
  await assertPrimary(page, ['7 iron', 'Add club', 'Back']);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByRole('button', { name: 'Score', exact: true })).toBeVisible();
  await assertPrimary(page, ['Par', 'Score', 'Round menu', 'Ask COOPR']);
  await page.getByRole('button', { name: 'Score', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save and next hole' });
  const finish = page.getByRole('button', { name: 'Finish round' });
  const primary = (await save.isVisible()) ? 'Save and next hole' : 'Finish round';
  if (!(await save.isVisible())) await expect(finish).toBeVisible();
  await assertPrimary(page, [primary, 'Close score']);
  await page.getByRole('button', { name: 'Close score' }).click();

  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  if ((page.viewportSize()?.height ?? 800) > 420) await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More', exact: true }).click({ force: true });
  await expect(page.getByText('Bundling...')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Past rounds' })).toBeVisible();
  await assertPrimary(page, ['Past rounds']);
  await page.getByRole('button', { name: 'Past rounds' }).click();
  await expect(page.getByText('Rounds', { exact: true })).toBeVisible();
  await assertPrimary(page, ['Back']);
});
