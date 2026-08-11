import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('HealthLens E2E Import', () => {
  test('tiny fixture: imports a small ZIP, renders HRV dashboard, tests filters and idempotency', async ({ page }) => {
    const fixturePath = path.resolve(__dirname, 'tiny_fixture.zip');

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.goto('/');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    
    const startTime = Date.now();
    await fileChooser.setFiles(fixturePath);
    await expect(page.locator('[data-testid="import-summary"]')).toBeVisible({ timeout: 10000 });
    const summaryText = await page.locator('[data-testid="import-summary"]').innerText();
    console.log(`BROWSER CONSOLE: Import Summary Text: ${summaryText}`);
    const duration = Date.now() - startTime;
    console.log(`Tiny fixture import duration: ${duration}ms`);
    
    await page.click('button:has-text("hrv")');
    await expect(page.locator('text=Overnight HRV Median')).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    await page.selectOption('select', { label: 'All Time' });
    
    await page.locator('input[type="checkbox"]').uncheck();
    await expect(page.locator('text=24-Hour HRV Median')).toBeVisible();
    
    await page.mouse.move(300, 300);
    await page.reload();
    await page.click('button:has-text("hrv")');
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    
    await page.click('button:has-text("upload")');
    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.locator('.border-dashed').click();
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(fixturePath);
    await expect(page.locator('[data-testid="import-summary"]')).toContainText('Import Skipped', { timeout: 5000 });
  });

  test('medium fixture: imports 10,000 row ZIP, handles chunks', async ({ page }) => {
    const fixturePath = path.resolve(__dirname, 'medium_fixture.zip');
    await page.goto('/');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    
    const startTime = Date.now();
    await fileChooser.setFiles(fixturePath);
    await expect(page.locator('[data-testid="import-summary"]')).toBeVisible({ timeout: 30000 });
    const duration = Date.now() - startTime;
    console.log(`Medium fixture import duration: ${duration}ms`);
    
    await page.click('button:has-text("hrv")');
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test('real Health Connect export: imports a REAL Health Connect ZIP, handles heavy processing', async ({ page }) => {
    test.setTimeout(90000); // 90 seconds timeout for heavy file
    
    await page.goto('/');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    
    const realZipPath = 'C:\\Users\\joshu_w0zb8cp\\Downloads\\Health Connect (1).zip';
    
    let lastProgressUpdate = Date.now();
    let maxWaitBetweenProgress = 0;
    let lastProgressText = '';
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PERF]')) {
        console.log(text);
      }
    });

    const startTime = Date.now();
    await fileChooser.setFiles(realZipPath);
    
    await expect(page.locator('[data-testid="import-summary"]')).toBeVisible({ timeout: 90000 });
    const duration = Date.now() - startTime;
    console.log(`Real export import duration: ${duration}ms`);
    
    await page.click('button:has-text("hrv")');
    await expect(page.locator('text=Overnight HRV Median')).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    await expect(page.locator('[data-testid="import-history"]')).toBeVisible();
  });
});
