import { expect, test, type Page } from '@playwright/test';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

async function box(page: Page, name: string | RegExp, exact = false) {
  const locator = page.getByRole('button', { name, exact }).first();
  await expect(locator).toBeVisible();
  const raw = await locator.boundingBox();
  expect(raw, String(name)).toBeTruthy();
  return raw!;
}

test('the score dock keeps its number and the course targets stay tappable', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const sweep = () => {
      const toast = document.getElementById('error-toast');
      if (!toast) return;
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    };
    setInterval(sweep, 100);
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 47.1123, lon: -122.2372 }));
    localStorage.setItem('coopr.speech.hold', '1');
  });
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await page.goto('/');
  await page.getByRole('button', { name: 'Tee off' }).click({ timeout: 30000 });
  await page.getByTestId('start-round').first().evaluate((node) => (node as HTMLElement).click());
  await expect(page.getByTestId('hole-map')).toBeVisible();

  const dock = await page.getByTestId('score-dock').boundingBox();
  expect(dock).toBeTruthy();
  expect(dock!.x).toBeLessThanOrEqual(1);
  expect(dock!.x + dock!.width).toBeGreaterThanOrEqual(viewport.width - 1);
  const par = await box(page, 'Par', true);
  const lower = await box(page, 'Lower the score');
  const raise = await box(page, 'Raise the score');
  const scoreBox = await box(page, 'Score', true);
  const menu = await box(page, 'Round menu', true);
  const mark = await box(page, /Mark shot/);
  const value = await page.getByLabel(/Score on the bar \d+/).boundingBox();
  expect(value).toBeTruthy();
  for (const target of [par, lower, raise, scoreBox, menu, mark, value!]) {
    expect(target.height).toBeGreaterThanOrEqual(56);
    expect(target.width).toBeGreaterThanOrEqual(56);
  }
  expect(par.width).toBeGreaterThanOrEqual(dock!.width - 8);
  expect(par.y + par.height).toBeLessThanOrEqual(lower.y + 2);
  for (const target of [raise, scoreBox, menu, mark, value!]) {
    expect(Math.abs(target.y - lower.y)).toBeLessThan(8);
  }
  await expect(page.getByRole('button', { name: 'Score previous hole' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Score next hole' })).toHaveCount(0);
  const holeNum = await page.getByRole('button', { name: 'Home' }).boundingBox();
  expect(holeNum).toBeTruthy();
  expect(holeNum!.height).toBeGreaterThanOrEqual(56);
  expect(holeNum!.width).toBeGreaterThanOrEqual(56);
  const pill = await page.getByTestId('hole-pill').boundingBox();
  const ball = await page.getByTestId('hole-number').boundingBox();
  expect(pill && ball).toBeTruthy();
  expect(ball!.x).toBeGreaterThanOrEqual(pill!.x + 1);
  expect(ball!.y).toBeGreaterThanOrEqual(pill!.y + 1);
  expect(ball!.x + ball!.width).toBeLessThanOrEqual(pill!.x + pill!.width - 1);
  expect(ball!.y + ball!.height).toBeLessThanOrEqual(pill!.y + pill!.height - 1);
  const chip = await page.getByTestId('club-chip-on').boundingBox();
  expect(chip).toBeTruthy();
  expect(chip!.height).toBeGreaterThanOrEqual(56);
  expect(chip!.width).toBeGreaterThanOrEqual(56);
  const plate = await page.getByTestId('yardage-plate').boundingBox();
  const chips = await page.getByTestId('club-chip-panel').boundingBox();
  const caddie = await page.getByTestId('coach-line').boundingBox();
  const askOrb = await page.getByRole('button', { name: 'Ask COOPR' }).boundingBox();
  expect(plate && chips && caddie && askOrb).toBeTruthy();
  expect(askOrb!.width).toBeGreaterThanOrEqual(56);
  expect(askOrb!.height).toBeGreaterThanOrEqual(56);
  expect(askOrb!.x + askOrb!.width).toBeGreaterThanOrEqual(viewport.width - 16);
  expect(Math.abs(askOrb!.y + askOrb!.height - dock!.y)).toBeLessThan(8);
  expect(overlaps(dock!, plate!), 'dock stays clear of the yardage').toBe(false);
  expect(overlaps(dock!, chips!), 'dock stays clear of the club chips').toBe(false);
  expect(overlaps(dock!, caddie!), 'dock stays clear of the caddie line').toBe(false);
  expect(overlaps(dock!, askOrb!), 'dock stays clear of Ask').toBe(false);
  expect(overlaps(askOrb!, plate!), 'Ask stays clear of the yardage').toBe(false);
  expect(overlaps(askOrb!, chips!), 'Ask stays clear of the club chips').toBe(false);
  expect(overlaps(askOrb!, caddie!), 'Ask stays clear of the caddie line').toBe(false);
  expect(overlaps(plate!, chips!), 'yardage stays clear of the club chips').toBe(false);
  await expect(page.getByText('FRONT', { exact: true })).toBeVisible();
  await expect(page.getByText('BACK', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Par', exact: true }).click();
  const undo = await box(page, 'Undo par');
  expect(undo.height).toBeGreaterThanOrEqual(56);
  expect(undo.width).toBeGreaterThanOrEqual(56);
  await page.getByRole('button', { name: 'Undo par' }).click();
  const bar = page.getByLabel(/Score on the bar \d+/);
  await expect(bar).toBeVisible();
  const startScore = Number((await bar.getAttribute('aria-label'))?.match(/\d+/)?.[0]);
  expect(startScore).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Raise the score' }).click();
  await page.getByRole('button', { name: 'Raise the score' }).click();
  const raised = startScore + 2;
  await expect(page.getByLabel(`Score on the bar ${raised}`)).toBeVisible();
  await page.getByRole('button', { name: 'Score', exact: true }).click();
  await expect(page.getByLabel(`Strokes ${raised}`)).toBeVisible();
  await page.getByRole('button', { name: 'Close score' }).click();
  await expect(page.getByLabel(`Score on the bar ${raised}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Par', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Round menu' }).click();
  await expect(page.getByTestId('round-menu-panel')).toBeVisible();
  const menuRow = await box(page, 'Pause round (keep progress)');
  expect(menuRow.height).toBeGreaterThanOrEqual(56);
  await page.getByRole('button', { name: 'Just yards' }).click();
  await expect(page.getByRole('button', { name: 'Just yards on' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Just yards on' }).click();
  await page.getByRole('button', { name: 'Battery saver' }).click();
  await expect(page.getByRole('button', { name: 'Battery saver on' })).toHaveAttribute('aria-checked', 'true');
  const outsideY = viewport.width > viewport.height ? 36 : 28;
  await page.mouse.click(Math.round(viewport.width * 0.55), outsideY);
  await expect(page.getByTestId('round-menu-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Round menu' }).click();
  await expect(page.getByTestId('round-menu-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Ask COOPR' }).click({ force: true });
  await expect(page.getByTestId('round-menu-panel')).toHaveCount(0);
  const typed = page.getByLabel('Typed ask');
  await expect(typed).toBeVisible();
  await typed.scrollIntoViewIfNeeded();
  const typedBox = await typed.boundingBox();
  expect(typedBox).toBeTruthy();
  expect(typedBox!.height).toBeGreaterThanOrEqual(48);
  await typed.fill('I made a 6');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByTestId('you-line')).toHaveText('I made a 6');
  await expect(page.getByText('Type a question.')).toHaveCount(0);
  await expect(page.getByText('Voice needs the TestFlight build. Type it instead')).toHaveCount(0);
  await expect(page.getByText('Save 6?')).toBeVisible();
  await expect(page.getByLabel('Score on the bar 6')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Par', exact: true })).toHaveCount(0);
  const cancel = await box(page, 'Cancel score');
  expect(cancel.height).toBeGreaterThanOrEqual(56);
  expect(cancel.width).toBeGreaterThanOrEqual(56);
  const confirmBar = await page.getByTestId('confirm-score').boundingBox();
  const you = await page.getByTestId('you-line').boundingBox();
  const askNow = await page.getByRole('button', { name: 'Ask COOPR' }).boundingBox();
  expect(confirmBar && you && askNow).toBeTruthy();
  expect(overlaps(confirmBar!, you!), 'Save bar stays clear of the You line').toBe(false);
  expect(overlaps(confirmBar!, askNow!), 'Save bar stays clear of Ask').toBe(false);
  if (viewport.width > viewport.height) {
    const sheet = await page.getByTestId('coach-sheet').boundingBox();
    const yards = await page.getByTestId('yardage-plate').boundingBox();
    const clubRow = await page.getByTestId('club-chip-panel').boundingBox();
    expect(sheet && yards && clubRow).toBeTruthy();
    expect(overlaps(sheet!, yards!), 'caddie stays clear of the yardage').toBe(false);
    expect(overlaps(sheet!, clubRow!), 'caddie stays clear of the club chips').toBe(false);
  }
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    const save = raw ? JSON.parse(raw) as { holes?: Array<number | null> } : {};
    return save.holes?.[0] ?? null;
  });
  expect(stored).toBeNull();
  const holeNo = (await page.getByRole('button', { name: 'Home' }).innerText()).trim();
  await page.getByRole('button', { name: 'Confirm score' }).click();
  await expect(page.getByTestId('caddie-answer')).toContainText(`Saved 6 on hole ${holeNo}`);
  await expect(page.getByTestId('you-line')).toHaveText('I made a 6');
});

test('a spoken score cannot be confirmed on the next hole', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const sweep = () => {
      const toast = document.getElementById('error-toast');
      if (!toast) return;
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    };
    setInterval(sweep, 100);
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 0, lon: 0 }));
    localStorage.setItem('coopr.speech.hold', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tee off' }).click({ timeout: 30000 });
  await page.getByTestId('start-round').first().evaluate((node) => (node as HTMLElement).click());
  await expect(page.getByTestId('hole-map')).toBeVisible();
  for (let step = 0; step < 4; step += 1) {
    const showing = (await page.getByRole('button', { name: 'Home' }).innerText()).trim();
    if (showing === '2') break;
    await page.getByRole('button', { name: Number(showing) < 2 ? 'Next hole' : 'Previous hole', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Home' })).toHaveText('2');
  await page.getByRole('button', { name: 'Ask COOPR' }).click({ force: true });
  await page.getByLabel('Typed ask').fill('I made a 4');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Save 4?')).toBeVisible();
  await expect(page.getByLabel('Score on the bar 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Home' })).toHaveText('3');
  await expect(page.getByText('Save 4?')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm score' })).toHaveCount(0);
  await expect(page.getByText('Par saved')).toHaveCount(0);
  await expect(page.getByText('Bogey saved')).toBeVisible();
  const holes = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    const save = raw ? JSON.parse(raw) as { holes?: Array<number | null> } : {};
    return save.holes ?? [];
  });
  expect(holes[1]).toBe(4);
  expect(holes[2] ?? null).toBeNull();
});

test('home sheet labels, copy, and the games setup stay in reach', async ({ page }) => {
  test.setTimeout(180000);
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
  if ((await page.getByTestId('home-sheet-level').getAttribute('data-level')) !== 'full') {
    await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  }

  const ask = page.getByRole('button', { name: 'Ask caddie', exact: true });
  const past = page.getByRole('button', { name: 'Past rounds', exact: true });
  await expect(ask).toBeVisible();
  await expect(past).toBeVisible();
  await expect(ask).toContainText('Ask caddie');
  await expect(past).toContainText('Past rounds');
  const askClipped = await ask.evaluate((node) =>
    [...node.querySelectorAll('*')].some((el) => (el.textContent ?? '').includes('Ask caddie') && el.scrollWidth > el.clientWidth + 2),
  );
  const pastClipped = await past.evaluate((node) =>
    [...node.querySelectorAll('*')].some((el) => (el.textContent ?? '').includes('Past rounds') && el.scrollWidth > el.clientWidth + 2),
  );
  expect(askClipped).toBe(false);
  expect(pastClipped).toBe(false);

  const actions = await page.getByTestId('home-actions').boundingBox();
  const recent = await page.getByTestId('recent-rounds').boundingBox();
  const tiles = await page.getByTestId('gross-tile').boundingBox();
  expect(actions && recent && tiles).toBeTruthy();
  expect(overlaps(actions!, recent!)).toBe(false);
  expect(overlaps(tiles!, recent!)).toBe(false);
  const analysis = page.getByRole('button', { name: 'Analysis', exact: true });
  await analysis.scrollIntoViewIfNeeded({ timeout: 10000 });
  await expect(analysis).toBeVisible();
  const analysisBox = await analysis.boundingBox();
  expect(analysisBox!.height).toBeGreaterThanOrEqual(56);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByText('One filled button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Setup' }).click();
  const savedName = (await page.getByLabel('Name, your entry').inputValue()).trim();
  if (savedName) {
    await expect(page.getByText('Your name is already saved. Handicap, driver speed, and flex live here.')).toBeVisible();
  } else {
    await expect(page.getByText('Your name is already saved')).toHaveCount(0);
    await expect(page.getByText('Add your name. Handicap, driver speed, and flex live here.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const games = page.getByRole('button', { name: 'Games' });
  const showMore = page.getByRole('button', { name: 'Show more' });
  await expect(page.getByTestId('home-sheet-handle')).toBeVisible();
  if (!(await games.isVisible())) {
    await showMore.click({ force: true });
    if ((await page.getByTestId('home-sheet-level').getAttribute('data-level')) !== 'full') {
      await showMore.click({ force: true });
    }
  }

  await page.getByRole('button', { name: 'Games' }).click();
  await expect(page.getByText('Birdie Bucks (BB) are points on this phone. They have no real-world value.')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Skins', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Stableford', exact: true })).toHaveAttribute('aria-selected', 'false');
  const rules = await page.getByRole('button', { name: 'Skins rules' }).boundingBox();
  expect(rules).toBeTruthy();
  expect(rules!.width).toBeGreaterThanOrEqual(44);
  expect(rules!.width).toBeLessThan(80);
  expect(rules!.height).toBeGreaterThanOrEqual(44);
  const start = await page.getByRole('button', { name: 'Start round' }).boundingBox();
  expect(start).toBeTruthy();
  expect(start!.height).toBeGreaterThanOrEqual(56);
  expect(start!.y + start!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(start!.y).toBeGreaterThan(viewport.height * 0.45);
  await expect(page.getByText('Add 2 player names.')).toBeVisible();

  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const gamesAgain = page.getByRole('button', { name: 'Games' });
  const showMoreAgain = page.getByRole('button', { name: 'Show more' });
  await expect(page.getByTestId('home-sheet-handle')).toBeVisible();
  if (!(await gamesAgain.isVisible())) await showMoreAgain.click({ force: true });
  await gamesAgain.click();
  await expect(page.getByLabel('Player 1 name')).toHaveValue('Ada');
  await page.getByLabel('Player 2 name').fill('Bea');
  await expect(page.getByText(/course handicap/)).toHaveCount(0);
  const startBtn = page.getByRole('button', { name: 'Start round' });
  await expect(startBtn).toBeEnabled();
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByLabel('Player 3 name').fill('Cy');
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByLabel('Player 4 name').fill('Dee');
  await page.getByRole('button', { name: 'Wolf', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Wolf', exact: true }).click();
  await startBtn.click();
  await expect(page.getByText('Skin carried')).toHaveCount(0);
  await expect(page.getByText(/skins carried/)).toHaveCount(0);
  const lower = page.getByRole('button', { name: 'Ada lower' });
  await expect(lower).toBeVisible();
  const lowerBox = await lower.boundingBox();
  expect(lowerBox!.height).toBeGreaterThanOrEqual(56);
  for (const name of ['Ada Par', 'Ada Birdie', 'Ada Bogey', 'Ada Double', 'Ada pickup']) {
    const hit = page.getByRole('button', { name, exact: true });
    await hit.scrollIntoViewIfNeeded();
    const raw = await hit.boundingBox();
    expect(raw, name).toBeTruthy();
    expect(raw!.height, name).toBeGreaterThanOrEqual(56);
  }
  const partner = page.getByRole('button', { name: /takes / }).first();
  await partner.scrollIntoViewIfNeeded();
  const partnerBox = await partner.boundingBox();
  expect(partnerBox).toBeTruthy();
  expect(partnerBox!.height).toBeGreaterThanOrEqual(56);
  const finish = page.getByRole('button', { name: 'Finish round' });
  await finish.scrollIntoViewIfNeeded();
  const finishBox = await finish.boundingBox();
  expect(finishBox!.height).toBeGreaterThanOrEqual(56);
});
