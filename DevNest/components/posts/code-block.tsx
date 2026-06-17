import { renderMarkdown } from "@/lib/markdown";

import { PostBody } from "./post-body";

type CodeBlockProps = {
  code: string;
  lang?: string;
  filename?: string;
  /**
   * Optional override for `data-code-style`. Without it, the block
   * inherits the value from the ancestor `<html>`. Setting it scopes
   * the chrome to a specific style for this one block — useful for
   * docs / examples / settings preview.
   */
  style?: "ide" | "card" | "subtle";
};

/**
 * Standalone code block for non-markdown contexts (settings preview,
 * docs, error states). Renders through the same Shiki pipeline as
 * markdown posts so syntax tokens match. The chrome (header bar, copy
 * button, optional gutter) lands in `<PostBody>` via DOM injection and
 * varies by `[data-code-style]` on the wrapper / `<html>`.
 */
export async function CodeBlock({ code, lang, filename, style }: CodeBlockProps) {
  const fenced = "```" + (lang ?? "text") + (filename ? " " + filename : "") + "\n" + code + "\n```";
  const { html } = await renderMarkdown(fenced);
  if (style) {
    return (
      <div data-code-style={style}>
        <PostBody html={html} />
      </div>
    );
  }
  return <PostBody html={html} />;
}
