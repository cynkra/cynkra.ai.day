import "server-only";

import { and, eq, exists, isNull, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { postTags, posts, tags, users } from "@/lib/db/schema";

export type UserHit = {
  id: string;
  handle: string;
  name: string | null;
  image: string | null;
  headline: string | null;
};

export type TagHit = {
  id: string;
  slug: string;
  displayName: string;
};

export type SearchResults = {
  users: UserHit[];
  tags: TagHit[];
};

const RESULT_LIMIT = 12;

/**
 * Whole-string ILIKE search across users and tags. Excludes:
 * - soft-deleted users
 * - tags with zero live posts (per spec — orphan tags don't surface in
 *   search even though their row still exists)
 *
 * Trims and lowercases the query, then matches `%<q>%` against handle,
 * display_name, slug. Empty/whitespace queries return empty results.
 */
export async function search(rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim();
  if (!q) return { users: [], tags: [] };

  const pattern = `%${q.toLowerCase()}%`;

  const [userHits, tagHits] = await Promise.all([
    db
      .select({
        id: users.id,
        handle: users.handle,
        name: users.name,
        image: users.image,
        headline: users.headline,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(ilike(users.handle, pattern), ilike(users.name, pattern)),
        ),
      )
      .limit(RESULT_LIMIT),
    db
      .select({
        id: tags.id,
        slug: tags.slug,
        displayName: tags.displayName,
      })
      .from(tags)
      .where(
        and(
          or(
            ilike(tags.slug, pattern),
            ilike(tags.displayName, pattern),
          ),
          exists(
            db
              .select({ one: sql<number>`1` })
              .from(postTags)
              .innerJoin(posts, eq(posts.id, postTags.postId))
              .where(
                and(
                  eq(postTags.tagId, tags.id),
                  isNull(posts.deletedAt),
                ),
              ),
          ),
        ),
      )
      .limit(RESULT_LIMIT),
  ]);

  return { users: userHits, tags: tagHits };
}
