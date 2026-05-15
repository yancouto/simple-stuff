import { test, expect } from '@playwright/test';
import path from 'path';

const INDEX_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

test.describe('Interval Graph UI - hover behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto(INDEX_URL);
    await page.waitForLoadState('networkidle');
  });

  test('shows current axis position above cursor while hovering timeline axis', async ({ page }) => {
    const indicator = page.locator('#positionIndicator');
    await page.evaluate(() => {
      const canvas = document.getElementById('timelineCanvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const event = new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + 80,
        bubbles: true
      });
      canvas.dispatchEvent(event);
    });

    await expect(indicator).toHaveClass(/visible/);
    await expect(indicator).toHaveText(/\d+\.\d/);
  });

  test('shows vertex degree in graph node tooltip title', async ({ page }) => {
    await page.click('#loadExample1');
    await expect(page.locator('.graph-node title')).toHaveCount(4);

    const nodeTitles = await page.locator('.graph-node title').allTextContents();
    const titleByName = Object.fromEntries(
      nodeTitles.map((text) => [text.trim().charAt(0), text])
    ) as Record<string, string>;

    expect(titleByName.A).toContain('Degree: 1');
    expect(titleByName.B).toContain('Degree: 2');
    expect(titleByName.C).toContain('Degree: 2');
    expect(titleByName.D).toContain('Degree: 1');
  });

  test('shows interval range label only while hovering a graph node', async ({ page }) => {
    await page.click('#loadExample1');
    await expect(page.locator('.graph-node .range-label')).toHaveCount(4);

    const visibleBeforeHover = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.graph-node .range-label'))
        .filter((el) => getComputedStyle(el).opacity === '1').length;
    });
    expect(visibleBeforeHover).toBe(0);

    await page.locator('.graph-node circle').first().hover();

    const visibleOnHover = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.graph-node .range-label'))
        .filter((el) => getComputedStyle(el).opacity === '1').length;
    });
    expect(visibleOnHover).toBe(1);

    await page.mouse.move(0, 0);

    const visibleAfterLeave = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.graph-node .range-label'))
        .filter((el) => getComputedStyle(el).opacity === '1').length;
    });
    expect(visibleAfterLeave).toBe(0);
  });
});
