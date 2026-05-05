import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const HANDLE_RE = /^[a-z0-9_]{3,32}$/;

/**
 * Reserved handles — top-level route paths and special slugs that must
 * never be addressable as `/u/<handle>` or otherwise collide with the
 * router. Keep this list in sync with the App Router as new routes land.
 */
export const RESERVED_HANDLES = new Set([
  "signin",
  "signup",
  "signout",
  "explore",
  "search",
  "settings",
  "feed",
  "t",
  "u",
  "p",
  "api",
  "me",
  "admin",
  "support",
  "help",
  "about",
  "privacy",
  "terms",
  "contact",
  "static",
  "_next",
]);

export type HandleValidation =
  | { ok: true; handle: string }
  | { ok: false; reason: "format" | "reserved" };

/**
 * Pure validator. Does NOT check uniqueness in the DB — call
 * `isHandleAvailable` for that.
 */
export function validateHandle(input: string): HandleValidation {
  const candidate = input.trim().toLowerCase();
  if (!HANDLE_RE.test(candidate)) {
    return { ok: false, reason: "format" };
  }
  if (RESERVED_HANDLES.has(candidate)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, handle: candidate };
}

/**
 * Best-effort transform of an arbitrary string into a valid handle base.
 * Strips disallowed characters, lowercases, truncates. Falls back to a
 * cuid2 fragment if nothing usable remains.
 */
export function slugifyToHandleBase(raw: string | null | undefined): string {
  if (!raw) return `u_${createId().slice(0, 8)}`;
  const cleaned = raw
    .toLowerCase()
    .replace(/@.*$/, "") // drop email domain if present
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28); // leave room for a numeric suffix
  if (cleaned.length < 3) return `u_${createId().slice(0, 8)}`;
  return cleaned;
}

async function handleExists(candidate: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, candidate))
    .limit(1);
  return rows.length > 0;
}

/**
 * Pick a unique, valid handle for a new user. Tries the slug derived from
 * `name` first, then `email`'s local part, then numbered variants of those.
 * Final fallback: a cuid2 — guaranteed unique by collision math.
 *
 * Used at sign-in time to swap the cuid2 default that
 * `users.handle.$defaultFn` assigned during user creation.
 */
export async function suggestHandle(input: {
  name?: string | null;
  email?: string | null;
  ignoreUserId?: string;
}): Promise<string> {
  const candidates: string[] = [];
  const baseFromName = input.name ? slugifyToHandleBase(input.name) : null;
  const baseFromEmail = input.email ? slugifyToHandleBase(input.email) : null;

  if (baseFromName) candidates.push(baseFromName);
  if (baseFromEmail && baseFromEmail !== baseFromName) {
    candidates.push(baseFromEmail);
  }

  for (const base of candidates) {
    const validated = validateHandle(base);
    if (!validated.ok) continue;
    if (!(await handleExists(validated.handle))) {
      return validated.handle;
    }
    // Append numeric suffix until unique. Cap iterations so a hostile
    // username with thousands of collisions can't stall sign-in.
    for (let i = 2; i < 100; i++) {
      const candidate = `${validated.handle}_${i}`;
      const v = validateHandle(candidate);
      if (!v.ok) break;
      if (!(await handleExists(v.handle))) {
        return v.handle;
      }
    }
  }

  // Fallback: cuid2 — collision-resistant and always passes validation.
  return createId();
}

export async function isHandleAvailable(
  handle: string,
  excludeUserId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);
  if (rows.length === 0) return true;
  return Boolean(excludeUserId) && rows[0]?.id === excludeUserId;
}
