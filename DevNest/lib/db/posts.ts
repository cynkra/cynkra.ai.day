import "server-only";

import { isNull } from "drizzle-orm";

import { posts } from "./schema/posts";

/**
 * SQL condition: `posts.deleted_at IS NULL`. AND this into every read of
 * the `posts` table so soft-deleted rows never leak into a feed, profile,
 * or direct-link view.
 *
 * @example
 *   db.select()
 *     .from(posts)
 *     .where(and(eq(posts.authorId, userId), live()));
 *
 * Direct `select(...).from(posts)` is **forbidden outside `lib/db/`**.
 * Always compose with `live()` here, or use a higher-level query helper
 * in `lib/feed/`. Keeping every soft-delete filter in one file makes the
 * "did we remember to skip deleted rows?" question answerable by reading
 * one place.
 *
 * Author-level soft deletion (a deleted user's posts vanishing from
 * feeds) is enforced separately when joining the `users` table; see
 * `lib/feed/`.
 */
export const live = () => isNull(posts.deletedAt);
