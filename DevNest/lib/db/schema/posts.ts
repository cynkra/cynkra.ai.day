import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const posts = pgTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),

    // Rendered HTML cache. `body_html_version` mirrors `RENDERER_VERSION`
    // in `lib/markdown`; on read, anything below the current version is
    // re-rendered lazily and re-stored.
    bodyHtml: text("body_html"),
    bodyHtmlVersion: integer("body_html_version"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    // Profile feed: posts by author, newest first.
    index("posts_author_created_idx").on(t.authorId, t.createdAt.desc()),
    // Discovery feed: newest live posts. Partial so soft-deleted rows are
    // skipped without a heap visit.
    index("posts_created_live_idx")
      .on(t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
