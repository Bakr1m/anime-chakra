import { expect, test } from '@playwright/test';

interface Stats {
  medianHue: number;
  peakLuma: number;
  brightFrac: number;
  motion: number;
}

interface Case {
  waitMs: number;
  hue: [number, number] | null;
}

// dominant-hue targets from the visual spec (degrees). Bunshin is a white
// poof: assert luma instead of hue. Bunshin is screenshotted early to catch
// the entry poofs; the others after full charge.
const CASES: Record<string, Case> = {
  rasengan: { waitMs: 3000, hue: [185, 225] },
  chidori: { waitMs: 3000, hue: [195, 270] },
  katon: { waitMs: 3000, hue: [5, 55] },
  bunshin: { waitMs: 1100, hue: null },
};

for (const [id, c] of Object.entries(CASES)) {
  test(`${id} renders: hue, bloom and motion`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`/?demo=${id}`);
    await page.waitForFunction(
      () => (window as unknown as { __chakraStats?: unknown }).__chakraStats !== undefined,
    );
    // let the state machine activate (6 frames) + charge; katon holds 0.5 s
    await page.waitForTimeout(c.waitMs);
    const s1 = (await page.evaluate(`(window.__chakraStats)()`)) as unknown as Stats;
    expect(s1.peakLuma, `${id} luminance peak`).toBeGreaterThan(0.55);
    expect(s1.brightFrac, `${id} bloom radius`).toBeGreaterThan(0.005);
    if (c.hue) {
      expect(s1.medianHue, `${id} dominant hue`).toBeGreaterThanOrEqual(c.hue[0]);
      expect(s1.medianHue, `${id} dominant hue`).toBeLessThanOrEqual(c.hue[1]);
    }
    // a screenshot pumps compositor frames, then motion must be visible.
    // Only the desktop project writes README assets (stable landscape shots).
    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: `../docs/img/demo-${id}.png` });
    } else {
      await page.screenshot();
    }
    await page.waitForTimeout(1200);
    const s2 = (await page.evaluate(`(window.__chakraStats)()`)) as unknown as Stats;
    expect(s2.motion, `${id} animates`).toBeGreaterThan(0.0005);
    expect(errors, `${id} console errors`).toEqual([]);
  });
}

test('start screen loads with privacy notice', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Chakra/);
  await expect(page.locator('.start-screen')).toBeVisible();
  await expect(page.locator('.privacy')).toContainText('runs on your device');
  const canvas = page.locator('.stage canvas');
  await expect(canvas).toHaveCount(0);
});
