import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { tags } from "./tags";
import { users } from "./users";

// Asymmetric follow graph (Twitter-style): A following B does not imply
// the reverse. The PK doubles as the "who do I follow" index; the explicit
// reverse index serves "who follows me".
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.targetUserId] }),
    index("follows_target_follower_idx").on(t.targetUserId, t.followerId),
  ],
);

export const tagFollows = pgTable(
  "tag_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tagId] })],
);

export type Follow = typeof follows.$inferSelect;
export type TagFollow = typeof tagFollows.$inferSelect;
