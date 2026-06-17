import { describe, expect, it } from "vitest";

import { isValidRequestId, resolveRequestId } from "@/lib/request-id";

describe("isValidRequestId", () => {
  it("accepts a UUID-looking value", () => {
    expect(isValidRequestId("abc12345-6789-4def-8123-456789abcdef")).toBe(true);
  });

  it("accepts an alphanumeric token of valid length", () => {
    expect(isValidRequestId("abc12345")).toBe(true);
    expect(isValidRequestId("a".repeat(128))).toBe(true);
  });

  it("rejects values shorter than 8 chars", () => {
    expect(isValidRequestId("short")).toBe(false);
  });

  it("rejects values longer than 128 chars", () => {
    expect(isValidRequestId("a".repeat(129))).toBe(false);
  });

  it("rejects values with whitespace or control characters", () => {
    expect(isValidRequestId("abc 1234")).toBe(false);
    expect(isValidRequestId("abc\n1234")).toBe(false);
    expect(isValidRequestId("abc\t1234")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isValidRequestId(null)).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });

  it("rejects values with disallowed punctuation", () => {
    expect(isValidRequestId("abc!1234")).toBe(false);
    expect(isValidRequestId("abc$1234")).toBe(false);
  });
});

describe("resolveRequestId", () => {
  it("preserves a well-formed incoming id", () => {
    const incoming = "abc12345-6789-4def-8123-456789abcdef";
    expect(resolveRequestId(incoming, () => "GENERATED")).toBe(incoming);
  });

  it("generates a new id when incoming is missing", () => {
    expect(resolveRequestId(null, () => "GENERATED")).toBe("GENERATED");
    expect(resolveRequestId(undefined, () => "GENERATED")).toBe("GENERATED");
  });

  it("generates a new id when incoming is malformed", () => {
    expect(resolveRequestId("short", () => "GENERATED")).toBe("GENERATED");
    expect(resolveRequestId("has spaces", () => "GENERATED")).toBe("GENERATED");
  });

  it("uses crypto.randomUUID by default", () => {
    const id = resolveRequestId(null);
    // UUID v4 shape (36 chars, hyphens at positions 8/13/18/23).
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
