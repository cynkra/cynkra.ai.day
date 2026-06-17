import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // sequential against shared dev DB / Mailhog
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Reuse whatever's already serving on `url`. In dev that's `pnpm dev`;
    // in CI the workflow starts `pnpm start` (production build) before
    // running Playwright. The fallback `command` only fires when nothing
    // is listening on the port.
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
    } as Record<string, string>,
  },
});
