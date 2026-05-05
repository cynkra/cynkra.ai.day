import "server-only";

import { and, desc, eq, isNull, ne, notInArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { follows, users } from "@/lib/db/schema";

export type FollowSuggestion = {
  id: string;
  handle: string;
  name: string | null;
  image: string | null;
  headline: string | null;
  followerCount: number;
};

/**
 * Recommend users to follow. Default ranking is "most followed" — fine
 * for the MVP-scale graph. Once the social graph grows we'd swap in a
 * 2nd-degree-based recommender. Excludes:
 *   - the viewer themselves
 *   - soft-deleted users
 *   - users the viewer already follows (when viewer is signed in)
 */
export async function getFollowSuggestions(
  viewerId: string | null,
  limit = 3,
): Promise<FollowSuggestion[]> {
  let alreadyFollowing: string[] = [];
  if (viewerId) {
    const rows = await db
      .select({ targetUserId: follows.targetUserId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    alreadyFollowing = rows.map((r) => r.targetUserId);
  }

  const conditions = [isNull(users.deletedAt)];
  if (viewerId) {
    conditions.push(ne(users.id, viewerId));
    if (alreadyFollowing.length > 0) {
      conditions.push(notInArray(users.id, alreadyFollowing));
    }
  }

  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      image: users.image,
      headline: users.headline,
      followerCount:
        sql<number>`(select count(*)::int from ${follows} where ${follows.targetUserId} = ${users.id})`.as(
          "follower_count",
        ),
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(sql`follower_count`))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    name: r.name,
    image: r.image,
    headline: r.headline,
    followerCount: Number(r.followerCount ?? 0),
  }));
}
