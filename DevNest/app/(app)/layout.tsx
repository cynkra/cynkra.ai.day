import type { ReactNode } from "react";

// Layout for authenticated routes. The site-wide nav lives in the root
// layout; this group exists for per-page auth gating (via requireUser())
// and for any future authenticated-only chrome.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>;
}
