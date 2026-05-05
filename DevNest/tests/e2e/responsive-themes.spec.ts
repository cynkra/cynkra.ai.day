import { mkdir } from "node:fs/promises";

import { test, type ConsoleMessage, type Page } from "@playwright/test";

import { serializePreferences } from "@/lib/preferences/cookie";
import { signInViaMagicLink } from "./_helpers";

/**
 * Capture screenshots and console errors across all surfaces × two
 * themes (light, dark) × two viewports (desktop, mobile). Goal: catch
 * any defect that's invisible at the default light-desktop pass.
 *
 * Output: test-results/responsive/<surface>-<theme>-<viewport>.png
 *         test-results/responsive/<surface>-<theme>-<viewport>.json
 */

const OUTPUT_DIR = "test-results/responsive";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 }, // iPhone 14
] as const;

const THEMES = ["light", "dark"] as const;

const PAGES: { slug: string; path: string; auth?: boolean }[] = [
  { slug: "home", path: "/" },
  { slug: "signin", path: "/signin" },
  { slug: "explore", path: "/explore" },
  { slug: "feed", path: "/feed", auth: true },
  { slug: "settings", path: "/me/settings", auth: true },
  { slug: "profile", path: "/me", auth: true },
];

async function setPrefs(
  page: Page,
  theme: (typeof THEMES)[number],
) {
  await page.context().addCookies([
    {
      name: "devnest.prefs",
      value: serializePreferences({
        theme,
        density: "comfortable",
        layout: "three",
        codeStyle: "ide",
      }),
      url: "http://localhost:3000",
    },
  ]);
}

test.describe("responsive + dark-theme sweep", () => {
  test.describe.configure({ mode: "serial" });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${theme} · ${viewport.name}`, async ({
        page,
        request,
      }, testInfo) => {
        test.setTimeout(120_000);
        await mkdir(OUTPUT_DIR, { recursive: true });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setPrefs(page, theme);

        // Track console + page errors per page navigation.
        const issues: { surface: string; type: string; text: string }[] = [];
        const onConsole = (msg: ConsoleMessage) => {
          if (msg.type() !== "warning" && msg.type() !== "error") return;
          issues.push({
            surface: page.url(),
            type: msg.type(),
            text: msg.text(),
          });
        };
        const onPageError = (err: Error) => {
          issues.push({
            surface: page.url(),
            type: "pageerror",
            text: err.message,
          });
        };
        page.on("console", onConsole);
        page.on("pageerror", onPageError);

        let signedIn = false;
        for (const surface of PAGES) {
          if (surface.auth && !signedIn) {
            await signInViaMagicLink(page, request, testInfo.workerIndex);
            signedIn = true;
          }
          await page.goto(surface.path, { waitUntil: "load" });
          await page
            .waitForLoadState("networkidle", { timeout: 6000 })
            .catch(() => {});
          await page.screenshot({
            path: `${OUTPUT_DIR}/${surface.slug}-${theme}-${viewport.name}.png`,
            fullPage: true,
          });
        }

        page.off("console", onConsole);
        page.off("pageerror", onPageError);

        // Drop a tiny per-run report.
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${OUTPUT_DIR}/_${theme}-${viewport.name}.json`,
          JSON.stringify(issues, null, 2),
        );
      });
    }
  }
});
