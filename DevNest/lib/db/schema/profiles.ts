import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// `provider_profiles` holds a snapshot of the GitHub/GitLab profile fetched
// at sign-in. Indexed columns mirror what the profile UI renders directly;
// `raw` keeps the unparsed payload so item-6 deep-integration work can pull
// extra fields without a schema migration.
export const providerProfiles = pgTable(
  "provider_profiles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'github' | 'gitlab'

    avatarUrl: text("avatar_url"),
    htmlUrl: text("html_url"),
    publicRepoCount: integer("public_repo_count"),
    topLanguages: jsonb("top_languages").$type<string[]>(),

    raw: jsonb("raw"),

    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type NewProviderProfile = typeof providerProfiles.$inferInsert;
