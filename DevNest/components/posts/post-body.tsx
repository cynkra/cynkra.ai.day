"use client";

import { useEffect, useRef } from "react";

/**
 * Renders pre-sanitized post HTML and decorates each `<pre>` with the
 * DevNest CodeBlock chrome (header bar + language pill + copy button +
 * optional line-number gutter). The HTML comes from the server-side
 * markdown pipeline; the chrome is injected client-side because (a)
 * the gutter line count needs to follow the actual rendered text and
 * (b) the copy button is browser-only.
 *
 * The three visual variants (ide, card, subtle) are switched by
 * `[data-code-style]` on the ancestor `<html>` via CSS — a single
 * render handles all three.
 *
 * Notes on safety:
 * - Event delegation on a single click listener (not one per button)
 *   so we don't leak handlers when posts re-render.
 * - The injected button reads `<pre>.textContent` at click time, NOT
 *   the highlighted innerHTML — that gives the user the unhighlighted
 *   source text the spec contracts.
 */

// Inline SVGs that match the lucide-react `Copy` / `Check` glyphs at the
// 14×14 size we use in the code-block header. We keep them as strings
// so the chrome-injection runs synchronously without React (the chrome
// is built imperatively inside a useEffect to follow the rendered
// markdown's <pre> shape).
const COPY_SVG =`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

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

export function PostBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // 1) Decorate <pre> blocks with the CodeBlock chrome on mount and on
  //    HTML changes. Idempotent so repeated effect runs (StrictMode dev,
  //    HMR) don't stack wrappers.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pres = root.querySelectorAll("pre");
    pres.forEach((pre, idx) => {
      if (pre.closest(".codeblock")) return; // already decorated

      // Pull the language label off the inner <code class="language-X">
      const codeEl = pre.querySelector("code");
      const langClass = Array.from(codeEl?.classList ?? []).find((c) =>
        c.startsWith("language-"),
      );
      const lang = langClass ? langClass.slice("language-".length) : "";
      const langLabel = LANG_LABEL[lang.toLowerCase()] ?? lang.toUpperCase();

      const wrapper = document.createElement("div");
      wrapper.className = "codeblock";
      wrapper.dataset.codeblockIndex = String(idx);
      pre.parentNode?.insertBefore(wrapper, pre);

      // Header (language pill + copy button)
      const header = document.createElement("div");
      header.className = "codeblock-header";
      header.innerHTML =
        (langLabel ? `<span class="codeblock-lang">${langLabel}</span>` : "<span></span>") +
        `<button type="button" class="codeblock-copy" aria-label="Copy code">${COPY_SVG}<span class="codeblock-copy-label">Copy</span></button>`;
      wrapper.appendChild(header);

      // Body (gutter + pre)
      const body = document.createElement("div");
      body.className = "codeblock-body";
      const lineCount = (pre.textContent ?? "").replace(/\n$/, "").split("\n").length;
      const gutter = document.createElement("div");
      gutter.className = "codeblock-gutter";
      gutter.setAttribute("aria-hidden", "true");
      gutter.innerHTML = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join("");
      body.appendChild(gutter);
      body.appendChild(pre);
      wrapper.appendChild(body);
    });
  }, [html]);

  // 2) Single click listener handles every copy button via delegation.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handler = async (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest<HTMLButtonElement>(".codeblock-copy");
      if (!btn || !root.contains(btn)) return;
      const wrapper = btn.closest<HTMLDivElement>(".codeblock");
      const pre = wrapper?.querySelector("pre");
      if (!pre) return;
      const text = pre.textContent ?? "";
      const labelEl = btn.querySelector(".codeblock-copy-label");
      const iconHost = btn;
      try {
        await navigator.clipboard.writeText(text);
        if (labelEl) labelEl.textContent = "Copied";
        iconHost.querySelector("svg")?.replaceWith(svgFromString(CHECK_SVG));
        if (liveRef.current) liveRef.current.textContent = "Code copied to clipboard";
        setTimeout(() => {
          if (labelEl) labelEl.textContent = "Copy";
          iconHost.querySelector("svg")?.replaceWith(svgFromString(COPY_SVG));
        }, 1200);
      } catch {
        if (labelEl) labelEl.textContent = "Failed";
        setTimeout(() => {
          if (labelEl) labelEl.textContent = "Copy";
        }, 1200);
      }
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="post-body max-w-none"
        // The HTML has already been sanitized by `lib/markdown` before
        // reaching this point; trusting it here is the contract.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </>
  );
}

function svgFromString(s: string): SVGElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = s.trim();
  return tpl.content.firstElementChild as SVGElement;
}
