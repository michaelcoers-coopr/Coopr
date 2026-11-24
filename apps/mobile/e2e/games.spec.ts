import { expect, test } from '@playwright/test';

test('game cards explain Birdie Bucks and Wolf', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Show more' }).click({ force: true });
  await page.getByRole('button', { name: 'Games' }).click();
  await expect(page.getByRole('button', { name: 'Birdie Bucks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'BB', exact: true })).toHaveCount(0);
  await expect(page.getByText('Birdie Bucks (BB) are points on this phone. They have no real-world value.')).toBeVisible();
  const skins = page.getByRole('button', { name: 'Skins', exact: true });
  await skins.scrollIntoViewIfNeeded();
  const skinsBox = await skins.boundingBox();
  expect(skinsBox).toBeTruthy();
  expect(skinsBox!.height).toBeGreaterThanOrEqual(44);
  expect(skinsBox!.y + skinsBox!.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.getByText('Low score wins the hole. A tie carries it.')).toBeVisible();
  await page.getByRole('button', { name: 'Skins rules' }).click();
  await expect(page.getByText(/the skin carries to the next hole/)).toBeVisible();
  await expect(page.getByText('Needs four players.')).toBeVisible();
  await page.getByRole('button', { name: 'Nassau', exact: true }).click();
  await expect(page.getByText('More than one game can run at the same time.')).toBeVisible();
  await expect(page.getByText(/no read-only link/)).toBeVisible();
});
