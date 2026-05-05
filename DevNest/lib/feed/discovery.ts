import "server-only";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";

import { decodeCursor } from "./cursor";
import { shapePage } from "./home";
import type { FeedPage } from "./types";

export const DISCOVERY_PAGE_SIZE = 20;
export const DISCOVERY_WINDOW_DAYS = 30;

/**
 * Public discovery feed: recent (≤30 days), non-soft-deleted posts by
 * authors who haven't opted out via `users.discoverable = false`.
 * No follow filter — anyone (signed in or not) can view this.
 */
export async function getDiscoveryFeed(
  cursor: string | null,
  pageSize: number = DISCOVERY_PAGE_SIZE,
): Promise<FeedPage> {
  const decoded = decodeCursor(cursor);
  const windowStart = new Date(
    Date.now() - DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const conditions = [
    isNull(posts.deletedAt),
    isNull(users.deletedAt),
    eq(users.discoverable, true),
    gte(posts.createdAt, windowStart),
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
