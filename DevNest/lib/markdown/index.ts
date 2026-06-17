import "server-only";

import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { rehypeCodeBlockChrome } from "./rehype-codeblock-chrome";

/**
 * Bumped manually whenever the rendering pipeline changes in a way that
 * would alter cached HTML (theme swap, sanitizer rules, language list).
 * `posts.body_html_version` stores this on each row; render lazily when
 * the stored value is below the current version.
 *
 * v2 (DEFECTS.md → D-15 follow-up): code-block chrome is now produced
 * by `rehypeCodeBlockChrome` in the SSR pipeline rather than injected
 * client-side from `<PostBody>`'s `useEffect`. Cached v1 HTML lacks
 * the `.codeblock` / `.codeblock-body` wrappers and must be re-rendered
 * on next read.
 */
export const RENDERER_VERSION = 2;

/**
 * Languages supported by the syntax highlighter. Anything outside this
 * set falls back to plain monospaced text via Shiki's `fallbackLanguage`
 * config.
 */
export const SUPPORTED_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "python",
  "r",
  "rust",
  "go",
  "sql",
  "bash",
  "shell",
  "json",
  "yaml",
  "html",
  "css",
  "c",
  "cpp",
  "csharp",
  "java",
] as const;

/**
 * Sanitization schema based on the GitHub markup defaults. Allows:
 *
 * - `style` on `<span>`, `<code>`, and `<pre>` (Shiki applies inline
 *   color tokens here). Prose-level `style` on `<div>`, `<p>`, `<a>`,
 *   etc. is still stripped, so author-supplied
 *   `<div style="background:url(evil)">` is neutered.
 * - `class` on `<span>`, `<code>`, `<pre>` so the CodeBlock copy button
 *   can be wired up via attribute selectors on the client.
 *
 * The defaults already strip `<script>`, `<iframe>`, `on*` event
 * handlers, and `javascript:` URLs in `href`/`src`/`xlink:href`.
 */
const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Allow the chrome wrappers and the copy-button rehype emits.
    "div",
    "button",
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...((defaultSchema.attributes?.span as string[] | undefined) ?? []),
      "style",
      "className",
    ],
    code: [
      ...((defaultSchema.attributes?.code as string[] | undefined) ?? []),
      "style",
      "className",
    ],
    pre: [
      ...((defaultSchema.attributes?.pre as string[] | undefined) ?? []),
      "tabIndex",
      "style",
      "className",
    ],
    div: [
      ...((defaultSchema.attributes?.div as string[] | undefined) ?? []),
      "className",
      "ariaHidden",
      ["dataCodeblockIndex"],
    ],
    button: [
      ...((defaultSchema.attributes?.button as string[] | undefined) ?? []),
      "className",
      "type",
      "ariaLabel",
    ],
  },
};

type Processor = ReturnType<typeof buildProcessor>;

let cachedProcessor: Processor | null = null;

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      defaultLanguage: "text",
      fallbackLanguage: "text",
      langs: [...SUPPORTED_LANGUAGES],
    })
    // Wrap each <pre> in the DevNest CodeBlock chrome before sanitize
    // so the sanitizer sees a closed schema and rejects unexpected tags
    // injected by other transformers (e.g. user-supplied raw HTML).
    .use(rehypeCodeBlockChrome)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
}

function getProcessor(): Processor {
  if (!cachedProcessor) {
    cachedProcessor = buildProcessor();
  }
  return cachedProcessor;
}

export type RenderResult = {
  html: string;
  version: number;
};

/**
 * Render a markdown body to sanitized HTML with Shiki syntax highlighting.
 * Idempotent and side-effect free; the caller persists the result on the
 * post row alongside `body_html_version`.
 */
export async function renderMarkdown(body: string): Promise<RenderResult> {
  const processor = getProcessor();
  const file = await processor.process(body);
  return { html: String(file), version: RENDERER_VERSION };
}
