import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { postTags, posts, users } from "@/lib/db/schema";

import { decodeCursor } from "./cursor";
import { shapePage } from "./home";
import type { FeedPage } from "./types";

export const TAG_PAGE_SIZE = 20;

/**
 * Tag feed: posts carrying a given tag, joined back to authors so we can
 * filter out soft-deleted users. Newest first; cursor-paginated.
 */
export async function getTagFeed(
  tagId: string,
  cursor: string | null,
  pageSize: number = TAG_PAGE_SIZE,
): Promise<FeedPage> {
  const decoded = decodeCursor(cursor);
  const conditions = [
    eq(postTags.tagId, tagId),
    isNull(posts.deletedAt),
    isNull(users.deletedAt),
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
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(pageSize + 1);

  return shapePage(rows, pageSize);
}
