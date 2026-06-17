import "server-only";

import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  follows,
  postTags,
  posts,
  tagFollows,
  users,
} from "@/lib/db/schema";
import { RENDERER_VERSION, renderMarkdown } from "@/lib/markdown";

import { type FeedCursor, decodeCursor, encodeCursor } from "./cursor";
import type { FeedPage, FeedPostRow } from "./types";

export const HOME_PAGE_SIZE = 20;

/**
 * Home feed: union of posts authored by users `viewerId` follows AND
 * posts tagged with any tag `viewerId` follows. Excludes:
 *   - soft-deleted posts (`posts.deleted_at IS NOT NULL`)
 *   - posts by soft-deleted authors (`users.deleted_at IS NOT NULL`)
 *
 * Ordered strictly by `(created_at DESC, id DESC)`. Pagination is by
 * opaque cursor — clients receive `nextCursor` in the response and
 * pass it back unchanged for the next page.
 */
export async function getHomeFeed(
  viewerId: string,
  cursor: string | null,
  pageSize: number = HOME_PAGE_SIZE,
): Promise<FeedPage> {
  const decoded = decodeCursor(cursor);

  const followedUsers = db
    .select({ id: follows.targetUserId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));

  const taggedPostsExists = exists(
    db
      .select({ one: sql<number>`1` })
      .from(postTags)
      .innerJoin(tagFollows, eq(postTags.tagId, tagFollows.tagId))
      .where(
        and(
          eq(postTags.postId, posts.id),
          eq(tagFollows.userId, viewerId),
        ),
      ),
  );

  const conditions = [
    isNull(posts.deletedAt),
    isNull(users.deletedAt),
    or(
      // The viewer's own posts always appear in their home feed —
      // strict reading of the spec doesn't require this, but otherwise
      // posting and not seeing your own post would be a confusing UX.
      eq(posts.authorId, viewerId),
      inArray(posts.authorId, followedUsers),
      taggedPostsExists,
    ),
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

  return await shapePage(rows, pageSize);
}

// -----------------------------------------------------------------------------

type RawRow = {
  id: string;
  body: string;
  bodyHtml: string | null;
  bodyHtmlVersion: number | null;
  createdAt: Date;
  authorId: string;
  authorHandle: string;
  authorName: string | null;
  authorImage: string | null;
};

export async function shapePage(
  rows: RawRow[],
  pageSize: number,
): Promise<FeedPage> {
  const hasMore = rows.length > pageSize;
  const visible = hasMore ? rows.slice(0, pageSize) : rows;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          createdAtMs: last.createdAt.getTime(),
          postId: last.id,
        } satisfies FeedCursor)
      : null;
  const upgraded = await Promise.all(visible.map(toPostRow));
  return { posts: upgraded, nextCursor };
}

async function toPostRow(r: RawRow): Promise<FeedPostRow> {
  // Render-on-read upgrade: if the cached HTML predates the current
  // RENDERER_VERSION (e.g. a pipeline change like the SSR code-block
  // chrome added in v2 — DEFECTS.md → D-15), re-render now and write
  // back to the DB so subsequent reads serve the up-to-date HTML.
  let bodyHtml = r.bodyHtml;
  let bodyHtmlVersion = r.bodyHtmlVersion;
  if (
    bodyHtml === null ||
    bodyHtmlVersion === null ||
    bodyHtmlVersion < RENDERER_VERSION
  ) {
    const rendered = await renderMarkdown(r.body);
    bodyHtml = rendered.html;
    bodyHtmlVersion = rendered.version;
    // Persist the upgrade in the background. If the write fails (e.g.
    // read-replica routing), the next read will simply re-render —
    // not worth blocking the response on.
    void db
      .update(posts)
      .set({ bodyHtml, bodyHtmlVersion })
      .where(eq(posts.id, r.id))
      .catch(() => {});
  }
  return {
    id: r.id,
    body: r.body,
    bodyHtml,
    bodyHtmlVersion,
    createdAt: r.createdAt,
    author: {
      id: r.authorId,
      handle: r.authorHandle,
      name: r.authorName,
      image: r.authorImage,
    },
  };
}
