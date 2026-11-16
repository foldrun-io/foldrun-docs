// Key docs pages against committed baselines (FOL-196): the home page, a
// guide, two reference pages and the longest table page. A new layout,
// component or style shows here; a word changed in one page's prose does
// not need a baseline, so pages are shot at the top, not in full.
import { test, expect } from "@playwright/test";

const pages = [
  ["home", "/"],
  ["getting-started", "/getting-started/"],
  ["flows", "/flows/"],
  ["agents", "/agents/"],
  ["cli", "/cli/"],
  ["api", "/api/"],
];

for (const [name, path] of pages) {
  test(name, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { mask: [page.locator("time, [data-volatile]")] });
  });
}
