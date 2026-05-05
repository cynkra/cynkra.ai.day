/**
 * User preferences for the DevNest visual design (theme, density,
 * layout, code-style). Persisted to a single `devnest.prefs` cookie so
 * SSR pages can read the values and write them onto the `<html>` data
 * attributes on first paint — no FOUC.
 *
 * `users.preferences` (jsonb) is reserved for future server-side
 * personalisation; this MVP keeps the source of truth on the client
 * to stay within the "no new behavior" rule of the design change.
 */

export const PREFS_COOKIE = "devnest.prefs";

export const THEMES = ["light", "dark", "system"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const LAYOUTS = ["single", "two", "three", "wide"] as const;
export const CODE_STYLES = ["ide", "card", "subtle"] as const;

export type Theme = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];
export type Layout = (typeof LAYOUTS)[number];
export type CodeStyle = (typeof CODE_STYLES)[number];

export type Preferences = {
  theme: Theme;
  density: Density;
  layout: Layout;
  codeStyle: CodeStyle;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "comfortable",
  layout: "three",
  codeStyle: "ide",
};

function isOneOf<T extends readonly string[]>(
  arr: T,
  v: unknown,
): v is T[number] {
  return typeof v === "string" && (arr as readonly string[]).includes(v);
}

/**
 * Parse the cookie value (or anything user-controllable) into a fully
 * populated `Preferences`, falling back to defaults for unknown values.
 * Pure; safe to call from RSC, edge middleware, and tests.
 */
export function parsePreferences(raw: string | null | undefined): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (!parsed || typeof parsed !== "object") return DEFAULT_PREFERENCES;
  const obj = parsed as Record<string, unknown>;
  return {
    theme: isOneOf(THEMES, obj.theme) ? obj.theme : DEFAULT_PREFERENCES.theme,
    density: isOneOf(DENSITIES, obj.density)
      ? obj.density
      : DEFAULT_PREFERENCES.density,
    layout: isOneOf(LAYOUTS, obj.layout)
      ? obj.layout
      : DEFAULT_PREFERENCES.layout,
    codeStyle: isOneOf(CODE_STYLES, obj.codeStyle)
      ? obj.codeStyle
      : DEFAULT_PREFERENCES.codeStyle,
  };
}

export function serializePreferences(prefs: Preferences): string {
  return encodeURIComponent(JSON.stringify(prefs));
}
