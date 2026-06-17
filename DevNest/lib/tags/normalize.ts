const SLUG_RE = /^[a-z0-9-]{1,32}$/;
const NON_SLUG_CHARS = /[^a-z0-9-]+/g;

/**
 * Normalize a tag string to a canonical slug, or `null` if no usable
 * slug remains. Pure function — does NOT touch the DB.
 *
 *   normalizeTagSlug("#TypeScript")        -> "typescript"
 *   normalizeTagSlug("Hello World!")       -> "hello-world"
 *   normalizeTagSlug("   nextjs ")         -> "nextjs"
 *   normalizeTagSlug("???")                -> null
 *   normalizeTagSlug("a".repeat(40))       -> "aaaaaaaa..." (≤32 chars)
 */
export function normalizeTagSlug(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/^#+/, "") // drop leading hashtags
    .trim()
    .replace(NON_SLUG_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  if (!cleaned || !SLUG_RE.test(cleaned)) return null;
  return cleaned;
}

/**
 * Parse a free-text tag input (comma- or whitespace-separated) into a
 * deduplicated, capped list of valid slugs. Invalid tokens are silently
 * dropped — callers may want to surface this to users via the action's
 * form-state response.
 */
export function parseTagInput(input: string, max = 5): string[] {
  const tokens = input.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const slugs = new Set<string>();
  for (const token of tokens) {
    const slug = normalizeTagSlug(token);
    if (slug) slugs.add(slug);
    if (slugs.size >= max) break;
  }
  return [...slugs];
}
