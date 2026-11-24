import { expect, test } from '@playwright/test';

test('the home hole plays a suggested line and pauses when held', async ({ page }) => {
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Tee off' }).click({ timeout: 30000 });
  const line = page.getByTestId('suggested-line');
  await expect(line).toBeVisible();
  await expect(line).toContainText('Suggested line · estimated');
  const layer = page.getByTestId('flyover-layer');
  await expect(layer).toHaveAttribute('data-flyover', 'playing');
  await page.mouse.move(180, 120);
  await page.mouse.down();
  await page.mouse.move(220, 120, { steps: 6 });
  await expect(layer).toHaveAttribute('data-flyover', 'paused');
  await page.mouse.up();
  await expect(layer).toHaveAttribute('data-flyover', 'playing');
  const width = page.viewportSize()?.width ?? 393;
  await page.mouse.move(width - 30, 120);
  await page.mouse.down();
  await page.mouse.move(30, 120, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('course-pill')).toContainText('Hole 2');
  await expect(line).toBeVisible();
});
