import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { insert: vi.fn(), execute: vi.fn() },
}));

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: () => ({}),
}));

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next-auth/providers/github", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/gitlab", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/nodemailer", () => ({ default: () => ({}) }));

import { shouldAllowSignIn } from "@/auth";

describe("shouldAllowSignIn", () => {
  it("allows email magic-link sign-in unconditionally", () => {
    expect(
      shouldAllowSignIn({ accountType: "email", emailVerifiedFlag: undefined }),
    ).toBe(true);
  });

  it("allows credentials sign-in unconditionally", () => {
    expect(
      shouldAllowSignIn({ accountType: "credentials", emailVerifiedFlag: false }),
    ).toBe(true);
  });

  it("allows OAuth sign-in when the provider has verified the email", () => {
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: true }),
    ).toBe(true);
  });

  it("rejects OAuth sign-in when email_verified is false", () => {
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: false }),
    ).toBe(false);
  });

  it("rejects OAuth sign-in when email_verified is missing", () => {
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: undefined }),
    ).toBe(false);
  });

  it("rejects OIDC sign-in when email_verified is false", () => {
    expect(
      shouldAllowSignIn({ accountType: "oidc", emailVerifiedFlag: false }),
    ).toBe(false);
  });

  it("rejects OAuth sign-in when email_verified is a non-boolean truthy value", () => {
    // Strict equality — we only treat the literal `true` as verified.
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: "true" }),
    ).toBe(false);
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: 1 }),
    ).toBe(false);
  });
});
