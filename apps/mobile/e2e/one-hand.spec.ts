import { expect, test } from '@playwright/test';

test('par is one tap and the extra hole notes stay in the drawer', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const sweep = () => {
      const toast = document.getElementById('error-toast');
      if (!toast) return;
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    };
    setInterval(sweep, 100);
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 0, lon: 0 }));
  });
  const viewport = page.viewportSize() ?? { width: 393, height: 852 };
  await page.goto('/');
  await page.getByRole('button', { name: 'Use a starter bag' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByTestId('hole-map')).toBeVisible();
  const par = page.getByTestId('par-next');
  await expect(par).toBeVisible();
  const parBox = await par.boundingBox();
  expect(parBox).toBeTruthy();
  expect(parBox!.height).toBeGreaterThanOrEqual(56);
  expect(parBox!.y + parBox!.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.getByTestId('club-chip-panel')).toBeVisible();
  await expect(page.getByText('Putts', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Fairway', { exact: true })).toHaveCount(0);

  await par.click();
  await expect(page.getByTestId('hole-pill')).toHaveAttribute('aria-label', /Hole 2,/);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    const save = raw ? JSON.parse(raw) as { holes?: Array<number | null> } : {};
    return save.holes?.[0] ?? null;
  });
  expect(stored).toBe(5);

  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Undo last score' }).click();
  const undone = await page.evaluate(() => {
    const raw = localStorage.getItem('coopr.round.v1');
    const save = raw ? JSON.parse(raw) as { currentHole?: number; holes?: Array<number | null> } : {};
    return { hole: save.currentHole ?? null, first: save.holes?.[0] ?? null };
  });
  expect(undone.hole).toBe(1);
  expect(undone.first).toBeNull();
  await expect(page.getByTestId('par-next')).toBeVisible();

  await page.getByRole('button', { name: 'Round menu' }).click();
  await page.getByRole('button', { name: 'Just yards' }).click();
  await expect(page.getByTestId('club-chip-panel')).toHaveCount(0);
  await expect(page.getByTestId('yardage-plate').first()).toBeVisible();
  await page.getByRole('button', { name: 'Just yards on' }).click();
  await expect(page.getByTestId('club-chip-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Round menu' }).click();

  await page.getByRole('button', { name: 'Ask COOPR' }).click({ force: true });
  await page.getByLabel('Typed ask').fill('par');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Save 5?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm score' }).click();
  await expect(page.getByTestId('hole-pill')).toHaveAttribute('aria-label', /Hole 2,/);
});
