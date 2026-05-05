import { eq } from "drizzle-orm";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { RightRail } from "@/components/site/right-rail";
import { Sidebar } from "@/components/site/sidebar";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Authenticated app shell. Three-column grid (Sidebar · Main · RightRail)
 * keyed off `--col-nav` and `--col-side` from the design tokens, which
 * collapse to 0 at narrower data-layout values per tokens.md.
 *
 * Page-level auth gating still happens via requireUser() inside each
 * route — this layout is structural only, so /explore and /search can
 * also live under it without forcing sign-in.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  let viewer:
    | { handle: string; name: string | null; image: string | null }
    | null = null;
  if (session?.user?.id) {
    const [row] = await db
      .select({
        handle: users.handle,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (row) viewer = row;
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar viewer={viewer} />
      <main className="flex min-w-0 flex-1 justify-center px-4 py-6 md:px-8">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
      <RightRail authenticated={Boolean(viewer)} />
    </div>
  );
}
