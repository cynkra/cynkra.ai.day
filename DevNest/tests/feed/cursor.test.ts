import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/feed/cursor";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a valid cursor", () => {
    const cursor = { createdAtMs: 1_700_000_000_000, postId: "abc123" };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded).toEqual(cursor);
  });

  it("emits opaque base64url with no JSON-y characters", () => {
    const encoded = encodeCursor({ createdAtMs: 1234567890, postId: "x" });
    expect(encoded).not.toContain("{");
    expect(encoded).not.toContain('"');
    // Standard base64url alphabet
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeCursor("not-valid-base64-!!!")).toBeNull();
  });

  it("returns null for valid base64 with bad shape", () => {
    const bad = Buffer.from(JSON.stringify("just a string"), "utf8").toString(
      "base64url",
    );
    expect(decodeCursor(bad)).toBeNull();
  });

  it("returns null when ms is not a number", () => {
    const bad = Buffer.from(JSON.stringify(["not-a-number", "id"]), "utf8")
      .toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });

  it("returns null when postId is empty", () => {
    const bad = Buffer.from(JSON.stringify([1, ""]), "utf8").toString(
      "base64url",
    );
    expect(decodeCursor(bad)).toBeNull();
  });

  it("rejects NaN / Infinity in ms", () => {
    // NaN isn't representable in JSON, so test via direct base64 of crafted JSON.
    const nanCursor = Buffer.from('[null,"id"]', "utf8").toString("base64url");
    expect(decodeCursor(nanCursor)).toBeNull();
  });
});
