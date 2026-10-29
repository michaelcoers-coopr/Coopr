import { expect, test, type Page } from '@playwright/test';

async function dismissDevOverlay(page: Page) {
  await page.evaluate(() => {
    const toast = document.getElementById('error-toast');
    if (toast) {
      toast.style.setProperty('display', 'none', 'important');
      toast.style.setProperty('pointer-events', 'none', 'important');
    }
  });
}

test('two mocked GPS marks make a shot you can edit and delete', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
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
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: /START ROUND/ }).click();
  await expect(page.getByTestId('mark-shot')).toBeVisible();
  await page.getByTestId('mark-shot').click();
  await page.evaluate(() => {
    localStorage.setItem('coopr.gps.sim', JSON.stringify({ lat: 47.1133, lon: -122.2372 }));
  });
  await page.waitForTimeout(1200);
  await page.getByTestId('mark-shot').click();
  await page.getByRole('button', { name: 'Round menu' }).click();
  const readout = page.getByTestId('shot-readout');
  await expect(readout).toBeVisible();
  const readYards = async () => Number((await readout.innerText()).match(/[\d.]+/)?.[0]);
  const before = await readYards();
  expect(before).toBeGreaterThan(80);
  expect(before).toBeLessThan(180);
  await page.getByRole('button', { name: 'More shot yards' }).click();
  await expect.poll(readYards).toBeCloseTo(before + 1, 0);
  await page.getByRole('button', { name: 'Delete last shot' }).click();
  await expect(readout).toHaveCount(0);
  await page.getByRole('button', { name: 'Mute caddie' }).click();
  await expect(page.getByRole('button', { name: 'Caddie voice on' })).toBeVisible();
  await page.getByRole('button', { name: 'Hands-free off' }).click();
  await expect(page.getByRole('button', { name: 'Hands-free on' })).toBeVisible();
});
