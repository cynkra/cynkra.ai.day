"use client";

import { useEffect, useRef } from "react";

/**
 * Renders pre-sanitized post HTML and wires up the CodeBlock copy
 * button via event delegation. The HTML — including the
 * `.codeblock` / `.codeblock-body` / `.codeblock-gutter` chrome —
 * is produced server-side by `lib/markdown` so the visual frame is
 * present on first paint, before hydration. PostBody is therefore
 * "use client" only because it needs `addEventListener` for the
 * copy button; it does *not* mutate the DOM otherwise.
 *
 * Notes on safety:
 * - One delegated click listener (not one per button) so we don't
 *   leak handlers when posts re-render.
 * - The button reads `<pre>.textContent` at click time, NOT the
 *   highlighted innerHTML — that gives the user the unhighlighted
 *   source the spec contracts.
 */

// Inline SVGs that match the lucide-react `Copy` / `Check` glyphs at
// 14×14. Stored as strings because we paint them in directly via the
// click handler (no React tree under the dangerously-set HTML).
const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

export function PostBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // Inject the copy-button SVG icons after mount. The buttons exist in
  // the SSR HTML but ship with just a "Copy" label — we paint the icon
  // here so the dangerously-set markdown stays free of inline SVG.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>(".codeblock-copy").forEach((btn) => {
      if (btn.querySelector("svg")) return; // already iconed (HMR / re-render)
      btn.insertBefore(svgFromString(COPY_SVG), btn.firstChild ?? null);
    });
  }, [html]);

  // Single delegated click listener — handles every copy button.
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
      try {
        await navigator.clipboard.writeText(text);
        if (labelEl) labelEl.textContent = "Copied";
        btn.querySelector("svg")?.replaceWith(svgFromString(CHECK_SVG));
        if (liveRef.current) liveRef.current.textContent = "Code copied to clipboard";
        setTimeout(() => {
          if (labelEl) labelEl.textContent = "Copy";
          btn.querySelector("svg")?.replaceWith(svgFromString(COPY_SVG));
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
