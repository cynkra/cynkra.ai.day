import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";

import { decodeCursor } from "./cursor";
import { shapePage } from "./home";
import type { FeedPage } from "./types";

export const PROFILE_PAGE_SIZE = 20;

/**
 * Profile feed: posts authored by `userId`, newest first. No follow
 * filter — anyone (signed in or not) can view a profile feed. Same
 * cursor shape as the home and discovery feeds so callers can swap
 * which feed they pull from without changing client code.
 */
export async function getProfileFeed(
  userId: string,
  cursor: string | null,
  pageSize: number = PROFILE_PAGE_SIZE,
): Promise<FeedPage> {
  const decoded = decodeCursor(cursor);
  const conditions = [
    isNull(posts.deletedAt),
    isNull(users.deletedAt),
    eq(posts.authorId, userId),
  ];

  if (decoded) {
    conditions.push(
      sql`(${posts.createdAt}, ${posts.id}) < (${new Date(decoded.createdAtMs)}::timestamptz, ${decoded.postId})`,
    );
  }

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      bodyHtml: posts.bodyHtml,
      bodyHtmlVersion: posts.bodyHtmlVersion,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorHandle: users.handle,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(pageSize + 1);

  return shapePage(rows, pageSize);
}
