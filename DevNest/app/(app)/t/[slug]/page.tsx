import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { FeedList } from "@/components/posts/feed-list";
import { FollowButton } from "@/components/follow/follow-button";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { getTagFeed } from "@/lib/feed/tag";
import { loadMoreTagFeed } from "@/lib/feed/load-more-actions";
import { getTagFollowerCount } from "@/lib/follow/counts";
import { isFollowingTag } from "@/lib/follow/queries";

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).toLowerCase();

  const [tag] = await db
    .select({ id: tags.id, slug: tags.slug, displayName: tags.displayName })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);
  // Spec: HTTP 404 when slug has no `tags` row.
  if (!tag) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const [initialPosts, followerCount, viewerFollows] = await Promise.all([
    getTagFeed(tag.id, null),
    getTagFollowerCount(tag.id),
    viewerId ? isFollowingTag(viewerId, tag.id) : Promise.resolve(false),
  ]);

  const tagId = tag.id;
  const loadMore = async (cursor: string) => {
    "use server";
    return loadMoreTagFeed(tagId, cursor);
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            #{tag.displayName}
          </h1>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">{followerCount}</strong>{" "}
            {followerCount === 1 ? "follower" : "followers"}
          </p>
        </div>
        <FollowButton
          type="tag"
          targetId={tag.id}
          initiallyFollowing={viewerFollows}
          authenticated={Boolean(viewerId)}
        />
      </header>

      <section className="mt-8 space-y-3">
        <FeedList
          // The tag-feed key tracks "first post id, or 'empty'" so a
          // freshly-tagged post causes the list to remount.
          key={initialPosts.posts[0]?.id ?? "empty"}
          initial={initialPosts}
          loadMore={loadMore}
          // Spec scenario: empty state when row exists but no live posts.
          emptyState={
            <p className="text-muted-foreground py-12 text-center text-sm">
              No posts tagged #{tag.displayName} yet.
            </p>
          }
        />
      </section>
    </main>
  );
}
