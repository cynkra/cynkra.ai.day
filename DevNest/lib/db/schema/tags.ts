import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { citext } from "./_shared";
import { posts } from "./posts";

// Tags are first-class so users can follow a tag without us indexing strings
// on every post. Normalization (lowercase, trim, [a-z0-9-]) is enforced at
// the validation boundary (task 7.1); citext gives us case-insensitive
// uniqueness as a defense in depth.
export const tags = pgTable("tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  slug: citext("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    // Tag feed: posts carrying a tag, joined back to posts for ordering.
    index("post_tags_tag_post_idx").on(t.tagId, t.postId),
  ],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PostTag = typeof postTags.$inferSelect;
