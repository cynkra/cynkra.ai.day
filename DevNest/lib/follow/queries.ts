import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { follows, tagFollows } from "@/lib/db/schema";

export async function isFollowingUser(
  followerId: string,
  targetUserId: string,
): Promise<boolean> {
  if (!followerId || !targetUserId || followerId === targetUserId) return false;
  const rows = await db
    .select({ one: follows.followerId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.targetUserId, targetUserId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function isFollowingTag(
  userId: string,
  tagId: string,
): Promise<boolean> {
  if (!userId || !tagId) return false;
  const rows = await db
    .select({ one: tagFollows.userId })
    .from(tagFollows)
    .where(and(eq(tagFollows.userId, userId), eq(tagFollows.tagId, tagId)))
    .limit(1);
  return rows.length > 0;
}
