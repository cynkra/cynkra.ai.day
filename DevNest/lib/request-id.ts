export const REQUEST_ID_HEADER = "x-request-id";

// Permissive enough to accept UUIDs (with dashes), nanoids, cuid2s,
// and most reasonable client-generated IDs; strict enough to reject
// whitespace, control characters, and anything that could be used
// for log injection.
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidRequestId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && REQUEST_ID_RE.test(value);
}

export function resolveRequestId(
  incoming: string | null | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string {
  return isValidRequestId(incoming) ? incoming : generate();
}
