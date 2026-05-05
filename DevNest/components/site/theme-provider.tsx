import type { ReactNode } from "react";

/**
 * Pass-through provider. Theme is sourced from the `devnest.prefs`
 * cookie and applied to `<html data-theme>` by `app/layout.tsx` on the
 * server; `<ThemeToggle>` writes the cookie via a server action and
 * optimistically flips the data attribute. We keep this component as a
 * named insertion point in case we re-introduce a context (e.g. for
 * announcing theme changes to non-cookie consumers) later.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
