import { getDiscoveryFeed } from "@/lib/feed/discovery";
import { loadMoreDiscoveryFeed } from "@/lib/feed/load-more-actions";
import { FeedList } from "@/components/posts/feed-list";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const initial = await getDiscoveryFeed(null);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Recent posts from across DevNest. No sign-in required.
      </p>

      <div className="mt-6">
        <FeedList
          initial={initial}
          loadMore={loadMoreDiscoveryFeed}
          emptyState={
            <p className="text-muted-foreground py-12 text-center text-sm">
              Nothing in the discovery feed yet. Be the first to post!
            </p>
          }
        />
      </div>
    </main>
  );
}
