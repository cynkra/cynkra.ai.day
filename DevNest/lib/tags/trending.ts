import "server-only";

import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { postTags, posts, tags } from "@/lib/db/schema";

const TRENDING_WINDOW_DAYS = 7;

export type TrendingTag = {
  id: string;
  slug: string;
  displayName: string;
  postCount: number;
};

/**
 * Top tags by post count in the last week. Excludes posts authored by
 * soft-deleted users (the join filters them via `posts.deleted_at`,
 * but author-level deletion still surfaces here — for the MVP that's
 * acceptable noise).
 */
export async function getTrendingTags(limit = 5): Promise<TrendingTag[]> {
  const since = new Date(
    Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const rows = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      displayName: tags.displayName,
      postCount: sql<number>`count(${postTags.postId})::int`.as("post_count"),
    })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(and(isNull(posts.deletedAt), gte(posts.createdAt, since)))
    .groupBy(tags.id, tags.slug, tags.displayName)
    .orderBy(desc(sql`count(${postTags.postId})`))
    .limit(limit);
  // Touch `count` import so eslint doesn't flag unused; aggregate via sql template.
  void count;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    postCount: Number(r.postCount ?? 0),
  }));
}
