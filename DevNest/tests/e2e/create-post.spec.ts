import { expect, test } from "@playwright/test";

import { signInViaMagicLink } from "./_helpers";

test.describe("create post", () => {
  test("create a post with a TypeScript code block, see it on feed and profile, copy the code", async ({
    page,
    request,
  }, testInfo) => {
    // Grant clipboard permissions up front; otherwise navigator.clipboard
    // throws inside Chromium and the copy button shows "Failed".
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    // 1. Sign in via magic link.
    await signInViaMagicLink(page, request, testInfo.workerIndex);
    await expect(page).toHaveURL(/\/feed$/);

    // 2. Compose a post with a unique marker + a TS code block.
    const marker = `e2e-marker-${Date.now()}`;
    const code = `const greet = (name: string) => \`hello, \${name}\`;`;
    const body = `${marker}\n\n\`\`\`ts\n${code}\n\`\`\``;

    await page.getByPlaceholder(/share something with code/i).fill(body);
    await page.getByRole("button", { name: /^post$/i }).click();

    // 3. Marker visible on the feed (the action revalidates `/feed`).
    await expect(page.getByText(marker)).toBeVisible();

    // 4. Marker visible on the author's profile feed.
    const profileLink = page
      .locator("article")
      .filter({ hasText: marker })
      .locator('a[href^="/u/"]')
      .first();
    const profileHref = await profileLink.getAttribute("href");
    expect(profileHref).toMatch(/^\/u\/.+/);
    await page.goto(profileHref!);
    await expect(page.getByText(marker)).toBeVisible();

    // 5. The code block has our injected copy button.
    const wrapper = page.locator(".codeblock-wrapper").first();
    await expect(wrapper.locator("pre")).toBeVisible();
    await wrapper.getByRole("button", { name: /copy/i }).click();

    // Read the clipboard back and assert the SOURCE text was copied
    // (not the highlighted innerHTML with <span> tokens). This is the
    // actual contract; the button-label flip is a UX nicety we don't
    // assert on directly because headless clipboard timing is flaky.
    await expect
      .poll(
        async () =>
          page.evaluate(() => navigator.clipboard.readText()),
        { timeout: 5000 },
      )
      .toContain("const greet = (name: string)");

    const fromClipboard = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(fromClipboard).not.toContain("<span");
  });
});
