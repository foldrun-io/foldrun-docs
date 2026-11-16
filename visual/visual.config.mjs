// docs.foldrun.io's look, compared with committed baselines (FOL-196, 16
// Nov 2026). Run by scripts/visual.sh inside Microsoft's Playwright image,
// against the built site: the same browser and fonts everywhere, so the
// baselines are made by CI on Linux (README → Visual baselines).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  outputDir: "/reports/visual",
  snapshotPathTemplate: "{testDir}/baselines/{arg}-{projectName}{ext}",
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  // maxDiffPixels is a fixed number, not a share of the page: CI shoots in
  // the same Playwright image every time, so an unchanged page differs by a
  // few anti-aliased pixels at most, while a share grows with a full-page
  // shot (0.2% of the kit demo hid a letter-spacing change on every heading).
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100, threshold: 0.2, animations: "disabled", caret: "hide", scale: "css" },
  },
  webServer: { command: "node serve.mjs", url: "http://127.0.0.1:4399/", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:4399", locale: "en-US", timezoneId: "UTC", reducedMotion: "reduce", deviceScaleFactor: 1 },
  projects: [
    { name: "light", use: { colorScheme: "light", viewport: { width: 1360, height: 900 } } },
    { name: "dark", use: { colorScheme: "dark", viewport: { width: 1360, height: 900 } } },
    { name: "phone", use: { colorScheme: "light", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
