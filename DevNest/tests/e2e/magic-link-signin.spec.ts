import { expect, test } from "@playwright/test";

import { signInViaMagicLink } from "./_helpers";

test.describe("magic-link sign-in", () => {
  test("emailing a magic link signs the user in and lands them on the feed", async ({
    page,
    request,
  }, testInfo) => {
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole("heading", { name: /^feed$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
