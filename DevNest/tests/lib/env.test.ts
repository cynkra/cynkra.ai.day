import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

const VALID = {
  NODE_ENV: "production",
  NEXTAUTH_URL: "https://devnest.example.com",
  AUTH_SECRET: "x".repeat(32),
  DATABASE_URL: "postgres://devnest:devnest@db:5432/devnest",
  GITHUB_CLIENT_ID: "abc",
  GITHUB_CLIENT_SECRET: "def",
  GITLAB_CLIENT_ID: "ghi",
  GITLAB_CLIENT_SECRET: "jkl",
  EMAIL_SERVER_HOST: "smtp.example.com",
  EMAIL_SERVER_PORT: "587",
  EMAIL_FROM: "DevNest <noreply@example.com>",
};

describe("parseEnv", () => {
  it("accepts a fully valid env object", () => {
    const result = parseEnv(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.NODE_ENV).toBe("production");
      expect(result.env.EMAIL_SERVER_PORT).toBe(587);
    }
  });

  it("rejects when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _omit, ...rest } = VALID;
    void _omit;
    const result = parseEnv(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("DATABASE_URL");
    }
  });

  it("rejects DATABASE_URL with the wrong scheme", () => {
    const result = parseEnv({ ...VALID, DATABASE_URL: "mysql://x@h/db" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const dbIssues = result.issues.filter((i) => i.path === "DATABASE_URL");
      expect(dbIssues.length).toBeGreaterThan(0);
    }
  });

  it("rejects an AUTH_SECRET shorter than 32 chars", () => {
    const result = parseEnv({ ...VALID, AUTH_SECRET: "too-short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.path === "AUTH_SECRET");
      expect(issue?.message).toMatch(/32/);
    }
  });

  it("rejects a non-numeric EMAIL_SERVER_PORT", () => {
    const result = parseEnv({ ...VALID, EMAIL_SERVER_PORT: "not-a-port" });
    expect(result.ok).toBe(false);
  });

  it("collects multiple issues at once", () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(3);
    }
  });
});
