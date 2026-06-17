"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updatePreferences } from "@/lib/preferences/actions";

const NO_SUBSCRIBE = () => () => {};
const SERVER_FALSE = () => false;

/**
 * Switches between light and dark themes. Single source of truth is the
 * `devnest.prefs` cookie (mirrored on `<html data-theme>` by the root
 * layout on every render). Clicking the toggle writes the cookie via a
 * server action, then optimistically flips the data attribute so the
 * UI updates without waiting for a server round-trip. We deliberately
 * do NOT use next-themes — its localStorage store would otherwise race
 * with the cookie on hydration and silently overwrite the SSR value
 * (see DEFECTS.md → D-9).
 *
 * `mounted` comes from `useSyncExternalStore` so we don't trip the
 * `react-hooks/set-state-in-effect` rule and so SSR renders the icon
 * matching the server's data-theme attribute.
 */
export function ThemeToggle() {
  const isDarkOnClient = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => document.documentElement.dataset.theme === "dark",
    SERVER_FALSE,
  );
  const [, startTransition] = useTransition();

  const flip = () => {
    const next = isDarkOnClient ? "light" : "dark";
    // Optimistically flip the attribute so every Tailwind dark variant
    // re-evaluates immediately. The cookie update is best-effort behind
    // the same call.
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      await updatePreferences({ theme: next });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={
        isDarkOnClient ? "Switch to light theme" : "Switch to dark theme"
      }
      onClick={flip}
    >
      {/* Render both icons; CSS handles which one shows. Avoids hydration mismatches. */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
