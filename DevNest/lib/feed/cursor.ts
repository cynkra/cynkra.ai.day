import { Buffer } from "node:buffer";

export type FeedCursor = { createdAtMs: number; postId: string };

/**
 * Encode a cursor as base64url JSON. Opaque to clients — they treat it
 * as a string and only the next-page request consumes it.
 */
export function encodeCursor(cursor: FeedCursor): string {
  const json = JSON.stringify([cursor.createdAtMs, cursor.postId]);
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * Decode an opaque cursor string. Returns `null` for any malformed
 * input — caller treats that as "no cursor" (start from the top).
 */
export function decodeCursor(value: string | null | undefined): FeedCursor | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length !== 2) return null;
    const [ms, id] = arr as unknown[];
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    if (typeof id !== "string" || !id) return null;
    return { createdAtMs: ms, postId: id };
  } catch {
    return null;
  }
}
