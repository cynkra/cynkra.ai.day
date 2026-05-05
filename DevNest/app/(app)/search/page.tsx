import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@/auth";
import { Input } from "@/components/ui/input";
import { SearchResultsView } from "@/components/search/search-results";
import { db } from "@/lib/db";
import { follows, tagFollows } from "@/lib/db/schema";
import { search } from "@/lib/search/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const results = await search(query);

  // Pre-compute the viewer's follow state for everything in the result
  // set so each FollowButton can render with the right initial label
  // without N+1 round-trips. Two queries: one per kind.
  let followingUserIds = new Set<string>();
  let followingTagIds = new Set<string>();
  if (viewerId) {
    const userIds = results.users.map((u) => u.id);
    const tagIds = results.tags.map((t) => t.id);
    const [followingUsers, followingTags] = await Promise.all([
      userIds.length > 0
        ? db
            .select({ targetUserId: follows.targetUserId })
            .from(follows)
            .where(
              and(
                eq(follows.followerId, viewerId),
                inArray(follows.targetUserId, userIds),
              ),
            )
        : Promise.resolve<{ targetUserId: string }[]>([]),
      tagIds.length > 0
        ? db
            .select({ tagId: tagFollows.tagId })
            .from(tagFollows)
            .where(
              and(
                eq(tagFollows.userId, viewerId),
                inArray(tagFollows.tagId, tagIds),
              ),
            )
        : Promise.resolve<{ tagId: string }[]>([]),
    ]);
    followingUserIds = new Set(followingUsers.map((r) => r.targetUserId));
    followingTagIds = new Set(followingTags.map((r) => r.tagId));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Find developers and topic tags.
      </p>

      <form className="mt-6">
        <Input
          type="search"
          name="q"
          placeholder="Search by handle, name, or tag…"
          defaultValue={query}
          autoComplete="off"
          aria-label="Search query"
        />
      </form>

      <div className="mt-8">
        <SearchResultsView
          query={query}
          results={results}
          viewer={{
            id: viewerId,
            followingUserIds,
            followingTagIds,
          }}
        />
      </div>
    </main>
  );
}
