import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { follows, tagFollows, users } from "@/lib/db/schema";

export type FollowCounts = { followers: number; following: number };

/**
 * Follower / following counts for a user, excluding soft-deleted users
 * on either side. Two separate queries because the join filters differ:
 *
 * - `followers`: count rows where target=userId AND the FOLLOWER user
 *   is not soft-deleted.
 * - `following`: count rows where follower=userId AND the TARGET user
 *   is not soft-deleted.
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followersRow, followingRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(
        and(eq(follows.targetUserId, userId), isNull(users.deletedAt)),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.targetUserId))
      .where(
        and(eq(follows.followerId, userId), isNull(users.deletedAt)),
      ),
  ]);

  return {
    followers: Number(followersRow[0]?.count ?? 0),
    following: Number(followingRow[0]?.count ?? 0),
  };
}

/**
 * Total followers of a tag (excluding soft-deleted users).
 */
export async function getTagFollowerCount(tagId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tagFollows)
    .innerJoin(users, eq(users.id, tagFollows.userId))
    .where(and(eq(tagFollows.tagId, tagId), isNull(users.deletedAt)));
  return Number(rows[0]?.count ?? 0);
}
