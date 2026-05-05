import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

import { signInViaMagicLink } from "./_helpers";

/**
 * One-off inspection pass. Walks every key surface of DevNest, captures:
 *  - HTTP status of the navigation
 *  - All console messages (warnings + errors)
 *  - All `pageerror` events (uncaught exceptions in the page)
 *  - All non-2xx network responses
 *  - A full-page screenshot
 *
 * Produces:
 *  - test-results/inspection/<slug>.png            (screenshot)
 *  - test-results/inspection/<slug>.json           (telemetry)
 *  - test-results/inspection/_summary.json         (rolled up)
 *
 * Run with:  pnpm test:e2e --reporter=list -- tests/e2e/inspection.spec.ts
 */

type Surface = {
  slug: string;
  path: string;
  description: string;
  /** When `true`, sign in via magic link before navigating. */
  authenticated?: boolean;
  /** Optional checks to run after the page loads. */
  expect?: (page: Page) => Promise<void>;
};

const SURFACES: Surface[] = [
  {
    slug: "01-home-public",
    path: "/",
    description: "Landing page, signed-out",
    expect: async (page) => {
      await expect(
        page.getByRole("heading", { name: /^DevNest$/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "02-signin",
    path: "/signin",
    description: "Sign-in card",
    expect: async (page) => {
      await expect(
        page.getByRole("heading", { name: /sign in to devnest/i }),
      ).toBeVisible();
      // The three provider buttons should all be visible (well, at
      // least the GitHub / GitLab pair plus the email expansion).
      await expect(
        page.getByRole("button", { name: /continue with github/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "03-explore-public",
    path: "/explore",
    description: "Discovery feed, signed-out",
    expect: async (page) => {
      await expect(
        page.getByRole("heading", { name: /^explore$/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "04-search-public",
    path: "/search?q=t",
    description: "Search results page, signed-out",
  },
  {
    slug: "05-feed-authenticated",
    path: "/feed",
    description: "Home feed (authenticated)",
    authenticated: true,
    expect: async (page) => {
      await expect(
        page.getByPlaceholder(/what's on your mind/i),
      ).toBeVisible();
    },
  },
  {
    slug: "06-me-authenticated",
    path: "/me",
    description: "Own profile (authenticated)",
    authenticated: true,
    expect: async (page) => {
      await expect(
        page.getByRole("link", { name: /edit profile/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "07-settings-authenticated",
    path: "/me/settings",
    description: "Settings + preferences (authenticated)",
    authenticated: true,
    expect: async (page) => {
      await expect(
        page.getByRole("heading", { name: /settings/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /appearance/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "08-tag-page",
    path: "/t/typescript",
    description: "Tag page (may 404 if no posts carry it)",
  },
];

const VIEWPORT = { width: 1280, height: 900 };
const OUTPUT_DIR = "test-results/inspection";

type SurfaceReport = {
  slug: string;
  path: string;
  description: string;
  authenticated: boolean;
  finalUrl: string | null;
  navigationStatus: number | null;
  /** All non-2xx responses for any request the page made. */
  badResponses: { url: string; status: number }[];
  consoleMessages: { type: string; text: string; location?: string }[];
  pageErrors: string[];
  expectError: string | null;
};

async function inspectSurface(
  page: Page,
  surface: Surface,
): Promise<SurfaceReport> {
  const consoleMessages: SurfaceReport["consoleMessages"] = [];
  const pageErrors: string[] = [];
  const badResponses: SurfaceReport["badResponses"] = [];

  const onConsole = (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== "warning" && type !== "error") return;
    const loc = msg.location();
    const entry: { type: string; text: string; location?: string } = {
      type,
      text: msg.text(),
    };
    if (loc.url) entry.location = `${loc.url}:${loc.lineNumber}`;
    consoleMessages.push(entry);
  };
  const onPageError = (err: Error) => {
    pageErrors.push(err.stack ?? err.message);
  };
  const onResponse = (res: import("@playwright/test").Response) => {
    const status = res.status();
    if (status >= 400) {
      badResponses.push({ url: res.url(), status });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let navigationStatus: number | null = null;
  let expectError: string | null = null;

  try {
    const response = await page.goto(surface.path, { waitUntil: "load" });
    navigationStatus = response?.status() ?? null;
    // A small settle period for client-side hydration / RSC stream.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    if (surface.expect) {
      try {
        await surface.expect(page);
      } catch (err) {
        expectError = err instanceof Error ? err.message : String(err);
      }
    }
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${surface.slug}.png`),
      fullPage: true,
    });
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }

  return {
    slug: surface.slug,
    path: surface.path,
    description: surface.description,
    authenticated: Boolean(surface.authenticated),
    finalUrl: page.url(),
    navigationStatus,
    badResponses,
    consoleMessages,
    pageErrors,
    expectError,
  };
}

test.describe("inspection — visual + console + network sweep", () => {
  test.use({ viewport: VIEWPORT });
  test.describe.configure({ mode: "serial" });

  test("walk every surface and dump a defect report", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Sign in once for the authenticated surfaces; the auth cookie
    // persists across navigations within the same context.
    let signedIn = false;
    const reports: SurfaceReport[] = [];

    for (const surface of SURFACES) {
      if (surface.authenticated && !signedIn) {
        await signInViaMagicLink(page, request, testInfo.workerIndex);
        signedIn = true;
      }
      const report = await inspectSurface(page, surface);
      reports.push(report);
      await writeFile(
        path.join(OUTPUT_DIR, `${surface.slug}.json`),
        JSON.stringify(report, null, 2),
      );
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      total: reports.length,
      withBadStatus: reports.filter((r) => (r.navigationStatus ?? 0) >= 400),
      withPageErrors: reports.filter((r) => r.pageErrors.length > 0),
      withConsoleErrors: reports.filter((r) =>
        r.consoleMessages.some((m) => m.type === "error"),
      ),
      withFailedExpectations: reports.filter((r) => r.expectError),
      reports,
    };
    await writeFile(
      path.join(OUTPUT_DIR, "_summary.json"),
      JSON.stringify(summary, null, 2),
    );

    // Surface counts in the test output so you can see the headline
    // without opening the JSON.
    console.log(
      JSON.stringify(
        {
          surfaces: reports.length,
          badStatus: summary.withBadStatus.length,
          pageErrors: summary.withPageErrors.length,
          consoleErrors: summary.withConsoleErrors.length,
          expectFailures: summary.withFailedExpectations.length,
        },
        null,
        2,
      ),
    );
  });
});
