import type { Element, ElementContent, Properties, Root } from "hast";
import { visit } from "unist-util-visit";

/**
 * Wraps every Shiki-emitted `<pre>` element in the DevNest CodeBlock
 * chrome (header bar + language pill + copy button placeholder + line
 * gutter). Lives in the rehype pipeline so the wrappers are baked into
 * the cached SSR HTML instead of being injected client-side from
 * `<PostBody>`. This keeps the visual chrome present on first paint
 * even before hydration — and makes the "naked `<pre>` with inline
 * `background:#fff`" failure mode (DEFECTS.md → D-15) impossible.
 *
 * The copy button stays a `<button>` — the click handler is wired up
 * by `<PostBody>` via event delegation. Server has no DOM, so we ship
 * a "Copy" label only; the inline SVG icon is added on the client.
 *
 * Output shape per `<pre>`:
 *
 *   <div class="codeblock" data-codeblock-index="N">
 *     <div class="codeblock-header">
 *       <span class="codeblock-lang">{LANG}</span>
 *       <button type="button" class="codeblock-copy" aria-label="Copy code">
 *         <span class="codeblock-copy-label">Copy</span>
 *       </button>
 *     </div>
 *     <div class="codeblock-body">
 *       <div class="codeblock-gutter" aria-hidden="true">
 *         <span>1</span><span>2</span>…
 *       </div>
 *       <pre …>…shiki output…</pre>
 *     </div>
 *   </div>
 */

const LANG_LABEL: Record<string, string> = {
  typescript: "TS",
  ts: "TS",
  tsx: "TSX",
  javascript: "JS",
  js: "JS",
  jsx: "JSX",
  python: "PY",
  r: "R",
  rust: "RS",
  go: "GO",
  sql: "SQL",
  bash: "SH",
  shell: "SH",
  json: "JSON",
  yaml: "YAML",
  html: "HTML",
  css: "CSS",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  java: "JAVA",
};

function classList(props: Properties | undefined): string[] {
  const cls = props?.className;
  if (Array.isArray(cls)) return cls.map((c) => String(c));
  if (typeof cls === "string") return cls.split(/\s+/);
  return [];
}

function getLanguage(pre: Element): string {
  const code = pre.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "code",
  );
  if (!code) return "";
  const langClass = classList(code.properties).find((c) =>
    c.startsWith("language-"),
  );
  return langClass ? langClass.slice("language-".length) : "";
}

function countLines(node: Element): number {
  // Each line ends up as a `<span class="line">` under Shiki's `<code>`.
  // Counting these is more robust than scanning text content (which
  // requires a separate to-string pass).
  let count = 0;
  visit(node, "element", (el) => {
    if (classList(el.properties).includes("line")) count += 1;
  });
  return Math.max(count, 1);
}

function el(
  tagName: string,
  properties: Properties,
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children };
}

function buildChrome(pre: Element, index: number): Element {
  const lang = getLanguage(pre);
  const langLabel = LANG_LABEL[lang.toLowerCase()] ?? lang.toUpperCase();
  const lineCount = countLines(pre);

  const header = el("div", { className: ["codeblock-header"] }, [
    el(
      "span",
      { className: ["codeblock-lang"] },
      langLabel ? [{ type: "text", value: langLabel }] : [],
    ),
    el(
      "button",
      {
        type: "button",
        className: ["codeblock-copy"],
        ariaLabel: "Copy code",
      },
      [
        el(
          "span",
          { className: ["codeblock-copy-label"] },
          [{ type: "text", value: "Copy" }],
        ),
      ],
    ),
  ]);

  const gutterChildren: ElementContent[] = [];
  for (let i = 1; i <= lineCount; i += 1) {
    gutterChildren.push(el("span", {}, [{ type: "text", value: String(i) }]));
  }
  const gutter = el(
    "div",
    { className: ["codeblock-gutter"], ariaHidden: "true" },
    gutterChildren,
  );

  const body = el("div", { className: ["codeblock-body"] }, [gutter, pre]);

  return el(
    "div",
    {
      className: ["codeblock"],
      dataCodeblockIndex: String(index),
    },
    [header, body],
  );
}

export function rehypeCodeBlockChrome() {
  return (tree: Root) => {
    let index = 0;
    visit(tree, "element", (node, idx, parent) => {
      if (node.tagName !== "pre" || idx === undefined || !parent) return;
      // Skip <pre> already wrapped (idempotent if the plugin is run twice).
      if (
        parent.type === "element" &&
        classList(parent.properties).includes("codeblock-body")
      ) {
        return;
      }
      const wrapped = buildChrome(node, index);
      index += 1;
      parent.children[idx] = wrapped;
      // Skip walking into the wrapped subtree — `pre` is now a child of
      // a fresh wrapper and we don't want to re-process it.
      return ["skip", idx + 1];
    });
  };
}
