import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import { getHomeFeed } from "@/lib/feed/home";
import { loadMoreHomeFeed } from "@/lib/feed/load-more-actions";
import { FeedList } from "@/components/posts/feed-list";
import { PostComposer } from "@/components/posts/post-composer";

export default async function FeedPage() {
  const user = await requireUser({ redirectTo: "/feed" });
  const initial = await getHomeFeed(user.id, null);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Posts from people and tags you follow.
      </p>

      <div className="mt-6">
        <PostComposer />
      </div>

      <div className="mt-6">
        <FeedList
          // Re-key on the newest post id so a freshly-created post
          // (which calls revalidatePath) remounts the list with new state
          // instead of stale local state from `useState(initial)`.
          key={initial.posts[0]?.id ?? "empty"}
          initial={initial}
          loadMore={loadMoreHomeFeed}
          emptyState={
            <div className="space-y-3 py-12 text-center">
              <p className="text-muted-foreground">
                Your home feed is empty. Follow some developers or tags to
                start seeing posts.
              </p>
              <Link
                href="/explore"
                className="text-primary inline-block text-sm font-medium hover:underline"
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
