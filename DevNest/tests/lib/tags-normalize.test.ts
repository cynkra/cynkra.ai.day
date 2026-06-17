import { describe, expect, it } from "vitest";

import { normalizeTagSlug, parseTagInput } from "@/lib/tags/normalize";

describe("normalizeTagSlug", () => {
  it("lowercases", () => {
    expect(normalizeTagSlug("TypeScript")).toBe("typescript");
  });

  it("strips a leading hashtag", () => {
    expect(normalizeTagSlug("#TypeScript")).toBe("typescript");
    expect(normalizeTagSlug("##nextjs")).toBe("nextjs");
  });

  it("trims whitespace", () => {
    expect(normalizeTagSlug("  hello  ")).toBe("hello");
  });

  it("replaces invalid characters with -", () => {
    expect(normalizeTagSlug("Hello World!")).toBe("hello-world");
    expect(normalizeTagSlug("c++")).toBe("c");
  });

  it("collapses repeated dashes", () => {
    expect(normalizeTagSlug("a--b")).toBe("a-b");
    expect(normalizeTagSlug("a___b")).toBe("a-b");
  });

  it("strips leading/trailing dashes", () => {
    expect(normalizeTagSlug("-foo-")).toBe("foo");
    expect(normalizeTagSlug("__foo__")).toBe("foo");
  });

  it("truncates to 32 chars", () => {
    expect(normalizeTagSlug("a".repeat(40))).toHaveLength(32);
  });

  it("returns null for empty / unusable input", () => {
    expect(normalizeTagSlug("")).toBeNull();
    expect(normalizeTagSlug("???")).toBeNull();
    expect(normalizeTagSlug("---")).toBeNull();
  });
});

describe("parseTagInput", () => {
  it("splits on commas and whitespace", () => {
    expect(parseTagInput("typescript, react,nextjs")).toEqual([
      "typescript",
      "react",
      "nextjs",
    ]);
    expect(parseTagInput("typescript react nextjs")).toEqual([
      "typescript",
      "react",
      "nextjs",
    ]);
  });

  it("dedupes after normalization", () => {
    expect(parseTagInput("TS, ts, ts")).toEqual(["ts"]);
    expect(parseTagInput("typescript, TypeScript, TYPESCRIPT")).toEqual([
      "typescript",
    ]);
  });

  it("treats whitespace-separated tokens as separate tags", () => {
    // Slugs can't contain spaces, so multi-word input is split, not joined.
    expect(parseTagInput("Hello World")).toEqual(["hello", "world"]);
  });

  it("respects the max cap", () => {
    const input = "a, b, c, d, e, f, g, h";
    expect(parseTagInput(input, 3)).toEqual(["a", "b", "c"]);
  });

  it("drops invalid tokens silently", () => {
    expect(parseTagInput("typescript, ???, react")).toEqual([
      "typescript",
      "react",
    ]);
  });

  it("strips hashtags", () => {
    expect(parseTagInput("#typescript #react")).toEqual([
      "typescript",
      "react",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseTagInput("")).toEqual([]);
    expect(parseTagInput("   ")).toEqual([]);
  });
});
