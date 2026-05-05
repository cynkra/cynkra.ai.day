import { expect, test } from "@playwright/test";

import {
  serializePreferences,
  type Density,
  type Theme,
} from "@/lib/preferences/cookie";
import { signInViaMagicLink } from "./_helpers";

/**
 * Visual review pass for the design-mvp change. Captures screenshots
 * across the key surfaces (/, /signin, /feed, /u/[handle], /t/[slug])
 * with light + dark themes and each density. The artifacts land under
 * `test-results/<test-id>/` so reviewers can diff by eye against the
 * design.md spec.
 *
 * These are NOT comparison screenshots — they don't use Playwright's
 * `toHaveScreenshot()`. They're just artifacts. Snapshot regression
 * lives outside this MVP.
 */

const THEMES: Theme[] = ["light", "dark"];
const DENSITIES: Density[] = ["compact", "comfortable", "spacious"];

async function setPrefs(
  page: import("@playwright/test").Page,
  prefs: { theme: Theme; density: Density },
) {
  await page.context().addCookies([
    {
      name: "devnest.prefs",
      value: serializePreferences({
        theme: prefs.theme,
        density: prefs.density,
        layout: "three",
        codeStyle: "ide",
      }),
      url: "http://localhost:3000",
    },
  ]);
}

test.describe("visual review — public pages", () => {
  for (const theme of THEMES) {
    test(`/ in ${theme}`, async ({ page }) => {
      await setPrefs(page, { theme, density: "comfortable" });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /devnest/i })).toBeVisible();
      await page.screenshot({
        path: `test-results/visual/home-${theme}.png`,
        fullPage: true,
      });
    });

    test(`/signin in ${theme}`, async ({ page }) => {
      await setPrefs(page, { theme, density: "comfortable" });
      await page.goto("/signin");
      await expect(
        page.getByRole("heading", { name: /sign in to devnest/i }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/visual/signin-${theme}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("visual review — authenticated pages", () => {
  for (const theme of THEMES) {
    for (const density of DENSITIES) {
      test(`/feed in ${theme} · ${density}`, async ({
        page,
        request,
      }, testInfo) => {
        await setPrefs(page, { theme, density });
        await signInViaMagicLink(page, request, testInfo.workerIndex);
        await expect(page).toHaveURL(/\/feed$/);
        await page.screenshot({
          path: `test-results/visual/feed-${theme}-${density}.png`,
          fullPage: true,
        });
      });
    }
  }
});
