import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, providerProfiles, users } from "@/lib/db/schema";

export type ProfileQueryResult = {
  user: {
    id: string;
    handle: string;
    name: string | null;
    image: string | null;
    headline: string | null;
    bio: string | null;
    deletedAt: Date | null;
  };
  linkedProviders: { provider: string }[];
  providerSnapshots: {
    provider: string;
    avatarUrl: string | null;
    htmlUrl: string | null;
    publicRepoCount: number | null;
    topLanguages: string[] | null;
  }[];
};

export type ProfileLookup =
  | { found: true; profile: ProfileQueryResult }
  | { found: false; reason: "unknown" | "deleted" };

/**
 * Lookup by case-insensitive handle. Returns:
 * - `{ found: false, reason: "unknown" }` when no row matches.
 * - `{ found: false, reason: "deleted" }` when the row is soft-deleted.
 * - `{ found: true, profile }` otherwise, with linked providers and
 *   profile snapshots in one round-trip.
 */
export async function getProfileByHandle(
  handle: string,
): Promise<ProfileLookup> {
  const userRows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      image: users.image,
      headline: users.headline,
      bio: users.bio,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);

  const row = userRows[0];
  if (!row) return { found: false, reason: "unknown" };
  if (row.deletedAt !== null) return { found: false, reason: "deleted" };

  const [linked, snapshots] = await Promise.all([
    db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, row.id)),
    db
      .select({
        provider: providerProfiles.provider,
        avatarUrl: providerProfiles.avatarUrl,
        htmlUrl: providerProfiles.htmlUrl,
        publicRepoCount: providerProfiles.publicRepoCount,
        topLanguages: providerProfiles.topLanguages,
      })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, row.id)),
  ]);

  return {
    found: true,
    profile: {
      user: row,
      linkedProviders: linked,
      providerSnapshots: snapshots,
    },
  };
}
