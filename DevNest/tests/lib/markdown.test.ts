import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown sanitizer", () => {
  it("strips <script> tags from author input", async () => {
    const { html } = await renderMarkdown(
      `Hello <script>alert(1)</script> world`,
    );
    // The element is gone; surviving "alert(1)" as plain text is the
    // standard sanitizer contract — it's no longer executable.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
  });

  it("strips inline event handlers like onclick", async () => {
    const { html } = await renderMarkdown(
      `[click me](https://example.com)\n\n<a href="https://example.com" onclick="evil()">x</a>`,
    );
    // The handler attribute is gone; "evil()" may survive as plain text
    // but cannot execute.
    expect(html).not.toMatch(/onclick=/i);
  });

  it("strips javascript: URLs from <a href>", async () => {
    const { html } = await renderMarkdown(
      `<a href="javascript:alert(1)">link</a>`,
    );
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("strips <iframe> elements", async () => {
    const { html } = await renderMarkdown(
      `<iframe src="https://evil.com"></iframe>`,
    );
    expect(html).not.toContain("<iframe");
  });

  it("renders fenced code blocks with shiki highlighting", async () => {
    const { html } = await renderMarkdown(
      "```ts\nconst x: number = 1;\n```",
    );
    // Shiki produces a <pre class="shiki ..."> wrapper with span tokens.
    expect(html).toMatch(/<pre[^>]*>/);
    expect(html).toContain("const");
    expect(html).toContain("number");
  });

  it("falls back gracefully for unrecognized fence languages", async () => {
    const { html } = await renderMarkdown(
      "```rolex\nblahblah\n```",
    );
    // Shiki's `fallbackLanguage: 'text'` keeps the body without throwing.
    expect(html).toMatch(/<pre[^>]*>/);
    expect(html).toContain("blahblah");
  });

  it("renders GFM tables and task lists", async () => {
    const { html } = await renderMarkdown(
      "| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo",
    );
    expect(html).toContain("<table");
    expect(html).toContain("<input");
    expect(html).toContain("checked");
  });

  it("returns the current renderer version", async () => {
    const { version } = await renderMarkdown("hello");
    expect(typeof version).toBe("number");
    expect(version).toBeGreaterThanOrEqual(1);
  });
});
