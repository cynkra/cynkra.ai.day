import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { getHomeFeed } from "@/lib/feed/home";
import { loadMoreHomeFeed } from "@/lib/feed/load-more-actions";
import { FeedList } from "@/components/posts/feed-list";
import { PostComposer } from "@/components/posts/post-composer";

export default async function FeedPage() {
  const user = await requireUser({ redirectTo: "/feed" });
  const [viewerRow] = await db
    .select({ handle: users.handle, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const initial = await getHomeFeed(user.id, null);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="sr-only">Feed</h1>

      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <PostComposer
          viewer={
            viewerRow
              ? {
                  handle: viewerRow.handle,
                  name: viewerRow.name,
                  image: viewerRow.image,
                }
              : { handle: null, name: null, image: null }
          }
        />
      </div>

      <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
        <FeedList
          // Re-key on the newest post id so a freshly-created post
          // (which calls revalidatePath) remounts the list with new state
          // instead of stale local state from `useState(initial)`.
          key={initial.posts[0]?.id ?? "empty"}
          initial={initial}
          loadMore={loadMoreHomeFeed}
          emptyState={
            <div className="space-y-3 px-6 py-12 text-center">
              <p className="text-muted-foreground text-[13px]">
                Follow some developers and tags to see posts here.
              </p>
              <Link
                href="/explore"
                className="text-primary inline-block text-[13px] font-medium hover:underline"
              >
                Browse the discovery feed →
              </Link>
            </div>
          }
        />
      </div>
    </main>
  );
}
