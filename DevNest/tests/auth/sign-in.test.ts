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

  // GitHub's OAuth /user payload doesn't carry an email_verified flag —
  // verification only lives on /user/emails. The dev-friendly policy is
  // to trust the provider; a stricter prod policy would override the
  // GitHub provider's `profile` callback to fetch /user/emails and
  // stamp the flag onto the profile before this gate runs.
  it("allows OAuth sign-in regardless of the email_verified flag", () => {
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: true }),
    ).toBe(true);
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: false }),
    ).toBe(true);
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: undefined }),
    ).toBe(true);
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: "true" }),
    ).toBe(true);
    expect(
      shouldAllowSignIn({ accountType: "oauth", emailVerifiedFlag: 1 }),
    ).toBe(true);
  });

  it("allows OIDC sign-in regardless of the email_verified flag", () => {
    expect(
      shouldAllowSignIn({ accountType: "oidc", emailVerifiedFlag: false }),
    ).toBe(true);
    expect(
      shouldAllowSignIn({ accountType: "oidc", emailVerifiedFlag: undefined }),
    ).toBe(true);
  });
});
