import { expect, test } from '@playwright/test';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

test('first launch asks for a name and setup keeps handicap', async ({ page }) => {
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
  await expect(page.getByLabel('Handicap, your entry')).toHaveCount(0);
  await expect(page.getByText(/estimated/i).first()).toBeVisible({ timeout: 30000 });
  const tee = page.getByRole('button', { name: 'Tee off' });
  const teeBox = await tee.boundingBox();
  expect(teeBox).toBeTruthy();
  expect(teeBox!.height).toBeGreaterThanOrEqual(44);
  expect(teeBox!.y + teeBox!.height).toBeLessThanOrEqual(viewport.height + 1);
  await tee.click();
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await expect(page.getByTestId('home-sheet-level')).toHaveAttribute('data-level', 'full');
  await page.waitForTimeout(400);
  const more = page.getByRole('button', { name: 'More', exact: true });
  await more.scrollIntoViewIfNeeded();
  await more.click();
  await page.getByRole('button', { name: 'Setup' }).click();
  const handicap = page.getByLabel('Handicap, your entry');
  await handicap.scrollIntoViewIfNeeded();
  const handicapBox = await handicap.boundingBox();
  const save = await page.getByRole('button', { name: 'Save setup' }).boundingBox();
  expect(handicapBox && save).toBeTruthy();
  expect(overlaps(handicapBox!, save!)).toBe(false);
  expect(handicapBox!.y + handicapBox!.height).toBeLessThanOrEqual(save!.y + 1);
  expect(save!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Regular flex' }).click();
  await page.getByRole('button', { name: 'Add 7 iron' }).click();
  await expect(page.getByText('7 iron').first()).toBeVisible();
});
