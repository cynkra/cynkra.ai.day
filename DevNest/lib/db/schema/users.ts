import { createId } from "@paralleldrive/cuid2";
import { boolean, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { citext } from "./_shared";

// `users` covers both Auth.js's user shape (id, name, email, emailVerified, image)
// and our app-specific developer-profile fields (handle, headline, bio,
// discoverable, deletedAt). Auth.js's TS field names are kept as-is so the
// official Drizzle adapter binds without remapping; spec terminology
// `display_name` -> `name`, `avatar_url` -> `image`.
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // Auth.js fields
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    image: text("image"),

    // App-specific fields
    // `$defaultFn` ensures Auth.js's adapter (which only sets id/name/email/
    // emailVerified/image) doesn't violate the NOT NULL constraint at user
    // creation. Section 5.1 replaces this with a handle suggested from the
    // OAuth username; the cuid2 fallback covers magic-link sign-ups and any
    // pre-section-5 race.
    handle: citext("handle")
      .notNull()
      .$defaultFn(() => createId()),
    headline: text("headline"),
    bio: text("bio"),
    discoverable: boolean("discoverable").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("users_handle_unique").on(t.handle)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
