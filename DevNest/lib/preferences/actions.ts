"use server";

import { cookies } from "next/headers";

import {
  DEFAULT_PREFERENCES,
  PREFS_COOKIE,
  parsePreferences,
  serializePreferences,
  type Preferences,
} from "./cookie";

/**
 * Persist a partial preference update to the cookie. We don't write to
 * `users.preferences` (jsonb) — that column doesn't exist in this MVP
 * (the design change is "no new behavior" / "no schema migration").
 *
 * The cookie is HTTP-only=false so client-side useful tooling can read
 * it; SameSite=Lax + Secure (in prod). Setting on every change lets
 * the next SSR pick up `<html data-*>` correctly.
 */
export async function updatePreferences(
  partial: Partial<Preferences>,
): Promise<Preferences> {
  const store = await cookies();
  const current = parsePreferences(store.get(PREFS_COOKIE)?.value);
  const next: Preferences = {
    theme: partial.theme ?? current.theme,
    density: partial.density ?? current.density,
    layout: partial.layout ?? current.layout,
    codeStyle: partial.codeStyle ?? current.codeStyle,
  };

  store.set({
    name: PREFS_COOKIE,
    value: serializePreferences(next),
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return next;
}

export async function resetPreferences(): Promise<Preferences> {
  return updatePreferences(DEFAULT_PREFERENCES);
}
