import { expect, test, type Page } from '@playwright/test';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

async function dismissDevOverlay(page: Page) {
  await page.evaluate(() => {
    const toast = document.getElementById('error-toast');
    if (!toast) return;
    toast.style.setProperty('display', 'none', 'important');
    toast.style.setProperty('pointer-events', 'none', 'important');
  });
}

test('mute, club chips, and the layout notes from 75b6b7d', async ({ page }) => {
  test.setTimeout(300000);
  const caddieHits: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/caddie') && request.method() === 'POST') caddieHits.push(request.url());
  });
  await page.addInitScript(() => {
    const flag = window as unknown as { __cooprHoldSpeech?: boolean };
    flag.__cooprHoldSpeech = true;
    localStorage.setItem('coopr.speech.hold', '1');
    const sweep = () => {
      const toast = document.getElementById('error-toast');
      if (!toast) return;
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    };
    setInterval(sweep, 100);
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 47.1123, lon: -122.2372 }));
  });
  await page.goto('/');
  await dismissDevOverlay(page);
  const teeOff = page.getByRole('button', { name: 'Tee off' });
  await expect(page.getByLabel('Name, your entry')).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('Handicap, your entry')).toHaveCount(0);
  const field = page.getByLabel('Name, your entry');
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox();
  const teeBox = await teeOff.boundingBox();
  expect(box && teeBox).toBeTruthy();
  expect(overlaps(box!, teeBox!), 'Name').toBe(false);
  await teeOff.click();
  await page.getByRole('button', { name: 'Show more' }).click();

  await page.getByRole('button', { name: /Bag,/ }).click();
  await expect(page.getByText('Starter').first()).toBeVisible();
  const putter = page.getByTestId('starter-club').filter({ hasText: 'Putter' });
  const lob = page.getByTestId('starter-club').filter({ hasText: 'Lob wedge' });
  await expect(putter).toBeVisible();
  await expect(lob).toBeVisible();
  await expect(putter).not.toContainText('Out of play');
  await expect(lob).not.toContainText('Out of play');
  await expect(page.getByText(/Out of play:.*(Putter|Lob wedge)/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('button', { name: 'ADD IT FAST' }).click();
  const modelField = page.getByRole('textbox', { name: 'Model' });
  const brandChip = page.getByRole('button', { name: 'Titleist', exact: true });
  await modelField.scrollIntoViewIfNeeded();
  const addClub = await page.getByRole('button', { name: 'Add club', exact: true }).boundingBox();
  const model = await modelField.boundingBox();
  expect(addClub && model).toBeTruthy();
  expect(overlaps(model!, addClub!)).toBe(false);
  await brandChip.scrollIntoViewIfNeeded();
  const brand = await brandChip.boundingBox();
  const addClubAgain = await page.getByRole('button', { name: 'Add club', exact: true }).boundingBox();
  expect(brand && addClubAgain).toBeTruthy();
  expect(overlaps(brand!, addClubAgain!)).toBe(false);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Show more' }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Course quality' }).click();
  await expect(page.getByText('‹ Back')).toBeVisible();
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[aria-label="Back"]')];
    const button = buttons.find((node) => (node.textContent ?? '').includes('‹')) ?? buttons[0];
    (button as HTMLElement | undefined)?.click();
  });
  await page.getByRole('button', { name: 'Past rounds' }).click();
  await expect(page.getByRole('button', { name: 'Ask COOPR' })).toHaveCount(0);
  const roundsBack = page.getByRole('button', { name: 'Back' });
  await expect(roundsBack).toBeVisible();
  const covered = await roundsBack.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit != null && !node.contains(hit) && hit !== node;
  });
  expect(covered).toBe(false);

  await page.goto('/');
  await page.getByRole('button', { name: /START ROUND|RESUME ROUND/ }).click();
  await expect(page.getByTestId('hole-map')).toBeVisible();
  await expect(page.getByText('0,0', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('map-scrim')).toHaveCount(0);
  const before = await page.getByTestId('hole-map').evaluate((el) => getComputedStyle(el).transform);
  const map = await page.getByTestId('hole-map').boundingBox();
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  const landscape = viewport.width > viewport.height;
  const dragX = landscape ? 220 : map!.x + map!.width / 2;
  const dragY = landscape ? 110 : Math.min(map!.y + 180, viewport.height * 0.42);
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX + 70, dragY + 24, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('map-offset')).toHaveCount(0);
  await expect(page.getByLabel('0,0')).toHaveCount(0);
  await expect(page.getByText('0,0', { exact: true })).toHaveCount(0);
  await expect.poll(async () => page.getByTestId('map-pan').getAttribute('data-offset')).not.toBe('0,0');
  const after = await page.getByTestId('hole-map').evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await expect(page.getByTestId('club-chip-on')).toBeVisible();
  await expect(page.getByTestId('club-chip-hint')).toHaveText('Swipe for clubs');
  await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.device.v1');
    const snap = raw ? JSON.parse(raw) as { measuredShots?: { clubId: string; yards: number }[] } : {};
    snap.measuredShots = Array.from({ length: 11 }, () => ({ clubId: 'starter-driver', yards: 294 }));
    localStorage.setItem('coopr.device.v1', JSON.stringify(snap));
  });
  await page.reload();
  await expect(page.getByTestId('coach-line')).toBeVisible();
  const mixed = await page.getByTestId('coach-line').innerText();
  expect(mixed).not.toMatch(/iron 5 carries 294|5 iron carries 294/i);
  if (viewport.width > viewport.height) {
    const note = page.getByTestId('course-note');
    if (await note.count()) {
      const noteBox = await note.boundingBox();
      const plateBox = await page.getByTestId('yardage-plate').boundingBox();
      if (noteBox && plateBox) expect(overlaps(noteBox, plateBox)).toBe(false);
    }
    const chipBox = await page.getByTestId('club-chips').boundingBox();
    const coachBox = await page.getByTestId('coach-line').boundingBox();
    if (chipBox && coachBox) expect(overlaps(chipBox, coachBox)).toBe(false);
  }
  const suggested = (await page.getByTestId('club-chip-on').innerText()).trim();
  const otherChip = page.getByTestId('club-chip').first();
  const otherName = (await otherChip.innerText()).trim();
  expect(otherName).not.toBe(suggested);
  await otherChip.click();
  await page.getByTestId('mark-shot').click();
  await expect(page.getByTestId('club-chip-on')).toHaveText(suggested);
  await expect(page.getByTestId('marked-toast')).toBeVisible();
  const toast = await page.getByTestId('marked-toast').boundingBox();
  const plate = await page.getByTestId('yardage-plate').boundingBox();
  expect(toast && plate).toBeTruthy();
  expect(overlaps(toast!, plate!)).toBe(false);
  await page.evaluate(() => {
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 47.1133, lon: -122.2372 }));
  });
  await page.waitForTimeout(1200);
  await page.getByTestId('mark-shot').click();
  await page.getByRole('button', { name: 'Round menu' }).click();
  const reviewed = page.getByTestId('hole-shot').first();
  await expect(reviewed).toBeVisible();
  const beforeShot = await reviewed.innerText();
  await page.getByTestId('reassign-shot').first().click();
  await expect(reviewed).not.toHaveText(beforeShot);
  const readout = page.getByTestId('shot-readout');
  await expect(readout).toBeVisible();
  const readYards = async () => Number((await readout.innerText()).match(/[\d.]+/)?.[0]);
  const yards = await readYards();
  await page.getByRole('button', { name: 'Fewer shot yards' }).click();
  await expect.poll(readYards).toBeCloseTo(yards - 1, 0);
  await page.getByTestId('shot-yards').fill('95');
  await page.getByTestId('shot-yards').dispatchEvent('input');
  await page.getByTestId('shot-yards').evaluate((node) => (node as HTMLInputElement).blur());
  await expect.poll(readYards).toBe(95);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.device.v1');
    const snap = raw ? JSON.parse(raw) as { measuredShots?: { clubId: string; yards: number }[] } : {};
    return snap.measuredShots ?? [];
  });
  expect(stored.length).toBeGreaterThan(0);
  expect(stored[stored.length - 1]?.yards).toBe(95);
  expect(stored[stored.length - 1]?.clubId).toBeTruthy();
  await page.getByRole('button', { name: 'Delete last shot' }).click();
  const afterDelete = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.device.v1');
    const snap = raw ? JSON.parse(raw) as { measuredShots?: unknown[] } : {};
    return snap.measuredShots ?? [];
  });
  expect(afterDelete).toHaveLength(stored.length - 1);
  const clubId = stored[stored.length - 1]?.clubId ?? '';
  await page.getByRole('button', { name: 'Round menu' }).click();

  await page.getByRole('button', { name: 'Ask COOPR' }).click({ force: true });
  await page.getByLabel('Typed ask').fill('What club for this starter bag?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect.poll(() => caddieHits.length).toBeGreaterThan(0);
  await expect.poll(async () => page.getByTestId('caddie-speech').innerText()).toBe('speaking');
  const fontSize = await page.getByTestId('caddie-answer').locator('text=/./').first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(fontSize).toBeLessThanOrEqual(18);
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Mute caddie' }).click();
  await expect(page.getByTestId('caddie-speech')).toHaveText('silent');
  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Ask COOPR' }).click({ force: true });
  await page.getByLabel('Typed ask').fill('Say that again');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByTestId('caddie-speech')).toHaveText('silent');
  await page.evaluate((id) => {
    const raw = localStorage.getItem('coopr.device.v1');
    const snap = raw ? JSON.parse(raw) as { measuredShots?: { clubId: string; yards: number }[] } : { measuredShots: [] };
    snap.measuredShots = [141, 144, 146, 148, 150].map((yards) => ({ clubId: id, yards }));
    localStorage.setItem('coopr.device.v1', JSON.stringify(snap));
  }, clubId);
  await page.reload();
  await expect(page.getByText(/from 5 shots/)).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Score', exact: true }).click();
  const advance = page.getByRole('button', { name: 'Save and next hole' });
  if (await advance.isVisible()) await advance.click();
  const thru = await page.getByTestId('thru-label').boundingBox();
  const plateAfter = await page.getByTestId('yardage-plate').boundingBox();
  expect(thru && plateAfter).toBeTruthy();
  expect(overlaps(thru!, plateAfter!)).toBe(false);

  if (viewport.height < 500) {
    await page.getByRole('button', { name: 'Hide coach' }).click({ force: true, timeout: 2000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Score', exact: true }).click({ force: true });
    const fieldHeight = await page.getByTestId('score-fields').evaluate((el) => el.clientHeight);
    expect(fieldHeight).toBeGreaterThanOrEqual(140);
    await page.getByRole('button', { name: 'Close score' }).click();
  }

  await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    const save = raw ? JSON.parse(raw) as { currentHole?: number; inProgress?: boolean } : {};
    save.currentHole = 18;
    save.inProgress = true;
    localStorage.setItem('coopr.round.v1', JSON.stringify(save));
  });
  await page.reload();
  await page.goto('/play');
  await expect(page.getByTestId('hole-finish')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('hole-finish')).toHaveAttribute('role', 'button');
  await expect(page.getByTestId('hole-finish-pill')).toHaveAttribute('role', 'button');
  const pillText = await page.getByTestId('hole-pill').innerText();
  expect(pillText).not.toMatch(/HCP/);
  const finishBox = await page.getByTestId('hole-finish').boundingBox();
  expect(finishBox!.width).toBeGreaterThanOrEqual(44);
  await page.goto('/scorecard');
  const pen = await page.getByRole('button', { name: 'Pen +' }).first().boundingBox();
  expect(pen).toBeTruthy();
  expect(pen!.x + pen!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 393) + 1);
  await page.goto('/recap');
  const done = await page.getByTestId('recap-done').boundingBox();
  expect(done).toBeTruthy();
  expect(done!.width).toBeGreaterThanOrEqual(44);
});
