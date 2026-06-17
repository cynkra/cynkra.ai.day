"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Global keyboard-shortcut listener — wires up the kbd hints the
 * sidebar / right rail advertise:
 *
 *   ⌘K (or Ctrl+K)   focus the global search input
 *   g h              navigate to /feed       (Home)
 *   g e              navigate to /explore    (Explore)
 *   g p              navigate to /me         (Profile)
 *   g ,              navigate to /me/settings (Settings)
 *
 * Mounted from the (app) layout so it only runs on authenticated /
 * shell pages. The g-prefix sequence has a 1 s window; after the second
 * key (or 1 s, whichever comes first) the prefix is cleared. Any key
 * event whose target is an editable element (input / textarea /
 * contenteditable) is ignored so users can type freely.
 */

const GO_TO: Record<string, string> = {
  h: "/feed",
  e: "/explore",
  p: "/me",
  ",": "/me/settings",
};

const SEQUENCE_TIMEOUT_MS = 1_000;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let goPrefix = false;
    let goPrefixTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPrefix = () => {
      goPrefix = false;
      if (goPrefixTimer !== null) {
        clearTimeout(goPrefixTimer);
        goPrefixTimer = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K — focus the global search input.
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        const search = document.querySelector<HTMLInputElement>(
          'input[name="q"]',
        );
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      // Don't intercept letter keys while the user is typing in a field.
      if (isEditableTarget(event.target)) return;

      // Ignore plain modifier-bearing keys for sequences.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (!goPrefix) {
        if (event.key === "g") {
          goPrefix = true;
          goPrefixTimer = setTimeout(clearPrefix, SEQUENCE_TIMEOUT_MS);
          // Don't preventDefault — pressing 'g' alone is harmless.
        }
        return;
      }

      // We're in the g-prefix window. Resolve or clear.
      const dest = GO_TO[event.key];
      clearPrefix();
      if (dest) {
        event.preventDefault();
        router.push(dest);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearPrefix();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  return null;
}
