"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const NO_SUBSCRIBE = () => () => {};
const CLIENT_TRUE = () => true;
const SERVER_FALSE = () => false;

/**
 * Switches between light and dark themes. Uses next-themes which writes
 * `class="dark"` on the html element; Tailwind v4's `@custom-variant dark`
 * picks that up. The `mounted` boolean comes from `useSyncExternalStore`
 * so we don't trip the `react-hooks/set-state-in-effect` rule.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    NO_SUBSCRIBE,
    CLIENT_TRUE,
    SERVER_FALSE,
  );

  const effective = mounted
    ? theme === "system"
      ? resolvedTheme
      : theme
    : "light";
  const isDark = effective === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Render both icons; CSS handles which one shows. Avoids hydration mismatches. */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
