import { writeFile, mkdir } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { signInViaMagicLink } from "./_helpers";

/**
 * Behaviour-level inspection. Each test probes a single interactive
 * promise the UI makes (a keyboard hint, a click, a focus state) and
 * records whether the app actually delivers on it. Outputs a concise
 * findings JSON to `test-results/interactions/_findings.json`.
 *
 * The tests don't `expect(...).toBe(...)` the broken cases — that
 * would just stop the run on the first defect. Instead they record
 * `ok: true|false` per probe so the full picture lands in the report
 * even when most things are broken.
 */

type Finding = {
  id: string;
  description: string;
  expected: string;
  actual: string;
  ok: boolean;
};

const FINDINGS: Finding[] = [];

function record(f: Finding) {
  FINDINGS.push(f);
}

async function htmlAttr(page: Page, name: string): Promise<string | null> {
  return page.evaluate(
    (n) => document.documentElement.getAttribute(n),
    name,
  );
}

async function activeElementSelector(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "<body>";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const name =
      "name" in el && (el as HTMLInputElement).name
        ? `[name=${(el as HTMLInputElement).name}]`
        : "";
    const role = el.getAttribute("role") ?? "";
    const aria = el.getAttribute("aria-label") ?? "";
    return `${tag}${id}${name}${role ? `[role=${role}]` : ""}${aria ? ` aria="${aria}"` : ""}`;
  });
}

// File-scope writer — runs once after every test in this file finishes,
// so findings from all describe blocks make it into the report.
test.afterAll(async () => {
  await mkdir("test-results/interactions", { recursive: true });
  await writeFile(
    "test-results/interactions/_findings.json",
    JSON.stringify(FINDINGS, null, 2),
  );
  const failures = FINDINGS.filter((f) => !f.ok);
  console.log(
    JSON.stringify(
      {
        total: FINDINGS.length,
        ok: FINDINGS.length - failures.length,
        failures: failures.length,
        failedIds: failures.map((f) => f.id),
      },
      null,
      2,
    ),
  );
});

test.describe("interactions — keyboard shortcuts the UI advertises", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.describe.configure({ mode: "serial" });

  test("⌘K focuses the search input on /feed", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);
    const before = await activeElementSelector(page);
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(200);
    const after = await activeElementSelector(page);
    const focused = after.toLowerCase().includes("input") && after.includes("[name=q]");
    record({
      id: "kbd-cmd-k",
      description: "Sidebar / right rail show a ⌘K kbd hint next to the search box.",
      expected: "Pressing ⌘K focuses the search input.",
      actual: `before=${before}, after=${after}`,
      ok: focused,
    });
  });

  test("'g h' navigates to /feed (vim-style nav)", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await page.goto("/me");
    await page.keyboard.press("g");
    await page.keyboard.press("h");
    await page.waitForTimeout(300);
    const url = page.url();
    record({
      id: "kbd-g-h",
      description: "The sidebar shows 'g h' as a kbd hint next to Home.",
      expected: "Pressing g then h navigates from /me to /feed.",
      actual: `final url = ${url}`,
      ok: /\/feed$/.test(url),
    });
  });

  test("'g e' navigates to /explore", async ({ page, request }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await page.goto("/me");
    await page.keyboard.press("g");
    await page.keyboard.press("e");
    await page.waitForTimeout(300);
    const url = page.url();
    record({
      id: "kbd-g-e",
      description: "The sidebar shows 'g e' as a kbd hint next to Explore.",
      expected: "Pressing g then e navigates to /explore.",
      actual: `final url = ${url}`,
      ok: /\/explore$/.test(url),
    });
  });

  test("⌘+Enter submits a post", async ({ page, request }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    const marker = `kbd-marker-${Date.now()}`;
    const composer = page.getByPlaceholder(/what's on your mind/i);
    await composer.click();
    await composer.fill(marker);
    await composer.press("Meta+Enter");

    // Give the action a chance to revalidate.
    await page.waitForTimeout(2000);
    const found = await page.getByText(marker).first().isVisible().catch(() => false);
    record({
      id: "kbd-cmd-enter-submit",
      description: "Composer documentation says ⌘+Enter submits a post.",
      expected: "After ⌘+Enter, the new post appears on /feed.",
      actual: `marker visible = ${found}`,
      ok: found,
    });
  });

  test("Esc collapses the composer toolbar", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    const composer = page.getByPlaceholder(/what's on your mind/i);
    await composer.click(); // expand
    // Toolbar is keyed off `data-focused` on the form; check the
    // post button is visible.
    const postBtn = page.getByRole("button", { name: /^post$/i });
    const expandedBefore = await postBtn.isVisible();
    await composer.press("Escape");
    await page.waitForTimeout(300);
    const expandedAfter = await postBtn.isVisible();
    record({
      id: "kbd-esc-collapse",
      description: "Composer documentation says Esc collapses the toolbar.",
      expected: "After Esc, the Post button is no longer visible.",
      actual: `before=${expandedBefore}, after=${expandedAfter}`,
      ok: expandedBefore && !expandedAfter,
    });
  });
});

test.describe("interactions — theme toggle + settings flips", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.describe.configure({ mode: "serial" });

  test("ThemeToggle in the dropdown flips data-theme", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    const before = await htmlAttr(page, "data-theme");
    // Open the profile dropdown in the sidebar footer.
    await page.getByRole("button", { name: /profile menu/i }).click();
    await page.waitForTimeout(300);
    // The Theme row contains the toggle button. Hit it.
    await page.getByRole("button", { name: /switch to (light|dark) theme/i }).click();
    await page.waitForTimeout(300);
    const after = await htmlAttr(page, "data-theme");
    record({
      id: "theme-toggle",
      description: "ThemeToggle in the sidebar dropdown flips light/dark.",
      expected: "data-theme on <html> changes between 'light' and 'dark'.",
      actual: `before=${before}, after=${after}`,
      ok: Boolean(before) && Boolean(after) && before !== after,
    });
  });

  test("Settings → Density 'compact' updates data-density on <html>", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await page.goto("/me/settings");

    const before = await htmlAttr(page, "data-density");
    // The density radios are wrapped in <label> containing the value text.
    await page.getByText(/^compact$/i).first().click();
    await page.waitForTimeout(400);
    const after = await htmlAttr(page, "data-density");
    record({
      id: "settings-density-compact",
      description: "Settings preferences write data-density on <html>.",
      expected: "Clicking 'Compact' sets data-density='compact'.",
      actual: `before=${before}, after=${after}`,
      ok: after === "compact",
    });
  });

  test("Settings → Code blocks 'subtle' updates data-code-style", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await page.goto("/me/settings");

    await page.getByText(/^subtle$/i).first().click();
    await page.waitForTimeout(400);
    const after = await htmlAttr(page, "data-code-style");
    record({
      id: "settings-code-style-subtle",
      description: "Settings preferences write data-code-style on <html>.",
      expected: "Clicking 'Subtle' sets data-code-style='subtle'.",
      actual: `after=${after}`,
      ok: after === "subtle",
    });
  });
});

test.describe("interactions — composer toolbar reveal + char counter tone", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.describe.configure({ mode: "serial" });

  test("Composer toolbar slides in on focus", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    const postBtn = page.getByRole("button", { name: /^post$/i });
    const visibleBefore = await postBtn.isVisible();
    await page.getByPlaceholder(/what's on your mind/i).click();
    await page.waitForTimeout(200);
    const visibleAfter = await postBtn.isVisible();
    record({
      id: "composer-reveal-on-focus",
      description: "Design says toolbar appears on focus.",
      expected: "Post button hidden at rest, visible after focusing the textarea.",
      actual: `before=${visibleBefore}, after=${visibleAfter}`,
      ok: !visibleBefore && visibleAfter,
    });
  });

  test("Char counter changes tone past the soft / hard threshold", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    const composer = page.getByPlaceholder(/what's on your mind/i);
    await composer.click();
    // Reach within 200 chars of the limit (10000 - 100 = 9900) for amber.
    await composer.fill("a".repeat(9_900));
    await page.waitForTimeout(150);
    const amberColor = await page
      .locator("[aria-live='polite']")
      .filter({ hasText: /\d+\/\d+/ })
      .first()
      .evaluate((el) => getComputedStyle(el).color);

    await composer.fill("a".repeat(10_001));
    await page.waitForTimeout(150);
    const redColor = await page
      .locator("[aria-live='polite']")
      .filter({ hasText: /\d+\/\d+/ })
      .first()
      .evaluate((el) => getComputedStyle(el).color);

    record({
      id: "composer-counter-tones",
      description: "Spec: counter goes amber within 200 chars of the limit, red when over.",
      expected: "amber color (warn) at 9900, red color (danger) at 10001",
      actual: `amber-rgb=${amberColor}, red-rgb=${redColor}`,
      // Heuristic: warn / danger colors should differ from each other.
      ok: amberColor !== redColor,
    });
  });
});

test.describe("interactions — sign out from sidebar dropdown", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Sign out from sidebar dropdown drops you back at /", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    // Open sidebar profile dropdown.
    await page.getByRole("button", { name: /profile menu/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForTimeout(800);
    const url = page.url();
    record({
      id: "signout-from-sidebar",
      description: "Sidebar profile dropdown has a Sign out item.",
      expected: "Clicking Sign out lands the visitor on /.",
      actual: `final url = ${url}`,
      ok: /:\/\/[^/]+\/?$/.test(url),
    });
  });
});
