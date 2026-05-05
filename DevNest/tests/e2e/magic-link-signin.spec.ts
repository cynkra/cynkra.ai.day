import { expect, test } from "@playwright/test";

import { signInViaMagicLink } from "./_helpers";

test.describe("magic-link sign-in", () => {
  test("emailing a magic link signs the user in and lands them on the feed", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);
    // The sidebar's "Home" link is only visible to signed-in users
    // (it's gated by `requiresAuth` in components/site/sidebar.tsx).
    await expect(
      page.getByRole("link", { name: /^home/i }).first(),
    ).toBeVisible();
  });
});
