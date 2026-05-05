import { describe, expect, it, vi } from "vitest";

// Mock the DB so we can test slugifyToHandleBase / validateHandle without
// touching Postgres. `suggestHandle` and `isHandleAvailable` are tested
// at integration level via the e2e magic-link flow.
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

import {
  RESERVED_HANDLES,
  slugifyToHandleBase,
  validateHandle,
} from "@/lib/auth/handle";

describe("validateHandle", () => {
  it("accepts a normal lowercase handle", () => {
    const result = validateHandle("alice");
    expect(result).toEqual({ ok: true, handle: "alice" });
  });

  it("lowercases mixed-case input", () => {
    const result = validateHandle("Alice_42");
    expect(result).toEqual({ ok: true, handle: "alice_42" });
  });

  it("trims surrounding whitespace", () => {
    const result = validateHandle("  bob  ");
    expect(result).toEqual({ ok: true, handle: "bob" });
  });

  it("rejects handles shorter than 3 chars", () => {
    expect(validateHandle("ab")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects handles longer than 32 chars", () => {
    expect(validateHandle("a".repeat(33))).toEqual({
      ok: false,
      reason: "format",
    });
  });

  it("rejects handles with disallowed characters", () => {
    expect(validateHandle("alice-bob")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("alice!")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("alice bob")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects each reserved token (>= 3 chars; shorter ones fail the format check first)", () => {
    for (const reserved of ["signin", "feed", "api", "explore", "admin", "settings"]) {
      expect(validateHandle(reserved)).toEqual({
        ok: false,
        reason: "reserved",
      });
    }
  });

  it("rejects single- and double-char reserved tokens for format (still rejected)", () => {
    // `t`, `u`, `me` are reserved but format also fails, format wins first.
    expect(validateHandle("t")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("u")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("me")).toEqual({ ok: false, reason: "format" });
  });

  it("considers the same uppercase forms reserved (case-insensitive)", () => {
    expect(validateHandle("SIGNIN")).toEqual({ ok: false, reason: "reserved" });
    expect(validateHandle("Signin")).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("RESERVED_HANDLES", () => {
  it("includes the route paths spec called out", () => {
    for (const path of ["signin", "explore", "t", "u", "api", "me"]) {
      expect(RESERVED_HANDLES.has(path)).toBe(true);
    }
  });
});

describe("slugifyToHandleBase", () => {
  it("preserves a clean lowercase identifier", () => {
    expect(slugifyToHandleBase("alice")).toBe("alice");
  });

  it("lowercases mixed case", () => {
    expect(slugifyToHandleBase("Alice")).toBe("alice");
  });

  it("strips an email domain", () => {
    expect(slugifyToHandleBase("dev@example.com")).toBe("dev");
  });

  it("replaces disallowed characters with underscores", () => {
    expect(slugifyToHandleBase("Hello World!")).toBe("hello_world");
  });

  it("collapses surrounding underscores", () => {
    expect(slugifyToHandleBase("___alice___")).toBe("alice");
  });

  it("truncates to leave room for a numeric suffix", () => {
    const long = "a".repeat(40);
    const result = slugifyToHandleBase(long);
    expect(result.length).toBeLessThanOrEqual(28);
  });

  it("falls back to a u_<random> handle for empty/short input", () => {
    expect(slugifyToHandleBase("")).toMatch(/^u_[a-z0-9]+$/);
    expect(slugifyToHandleBase(null)).toMatch(/^u_[a-z0-9]+$/);
    expect(slugifyToHandleBase("a")).toMatch(/^u_[a-z0-9]+$/);
  });
});
