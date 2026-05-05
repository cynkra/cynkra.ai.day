"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders pre-sanitized post HTML and decorates each `<pre>` with a copy
 * button. The HTML comes from the server-side markdown pipeline; the
 * button is injected client-side because copy is browser-only.
 *
 * Implementation notes:
 * - Event delegation on a single click listener (not one per button) so
 *   we don't leak handlers when posts re-render.
 * - The injected button reads `<pre>.textContent` at click time, NOT the
 *   highlighted innerHTML — that gives the user the unhighlighted source
 *   text the spec contracts.
 */
export function PostBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pres = root.querySelectorAll("pre");
    pres.forEach((pre, idx) => {
      if (pre.querySelector(":scope > .codeblock-copy")) return; // idempotent
      const wrapper = document.createElement("div");
      wrapper.className = "codeblock-wrapper relative";
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "codeblock-copy absolute right-2 top-2 rounded border border-border bg-background/90 px-2 py-1 text-xs font-medium shadow-sm hover:bg-muted focus:outline-none focus:ring-2";
      btn.dataset.codeblockIndex = String(idx);
      btn.setAttribute("aria-label", "Copy code");
      btn.textContent = "Copy";
      wrapper.appendChild(btn);
    });
  }, [html]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handler = async (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest<HTMLButtonElement>(".codeblock-copy");
      if (!btn || !root.contains(btn)) return;
      const wrapper = btn.parentElement;
      const pre = wrapper?.querySelector("pre");
      if (!pre) return;
      const text = pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        const idx = Number(btn.dataset.codeblockIndex ?? "-1");
        setCopiedId(idx);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
          setCopiedId((current) => (current === idx ? null : current));
        }, 1500);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1500);
      }
    };
    root.addEventListener("click", handler);
    return () => {
      root.removeEventListener("click", handler);
    };
  }, []);

  // Tracking copiedId in state lets future UI (e.g. screen-reader live
  // region) react to the copy event; intentionally unused in markup today.
  void copiedId;

  return (
    <div
      ref={ref}
      className="prose prose-neutral dark:prose-invert max-w-none"
      // The HTML has already been sanitized by `lib/markdown` before reaching
      // this point; trusting it here is the contract.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
