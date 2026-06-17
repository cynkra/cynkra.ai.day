import { afterEach, vi } from "vitest";

// Vitest sets NODE_ENV="test" automatically; the rest fills in what
// `parseEnv()` requires so transitive imports of `@/lib/env` don't exit.
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.AUTH_SECRET = "x".repeat(32);
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.GITHUB_CLIENT_ID = "test";
process.env.GITHUB_CLIENT_SECRET = "test";
process.env.GITLAB_CLIENT_ID = "test";
process.env.GITLAB_CLIENT_SECRET = "test";
process.env.EMAIL_SERVER_HOST = "localhost";
process.env.EMAIL_SERVER_PORT = "1025";
process.env.EMAIL_FROM = "DevNest <test@devnest.local>";

// `server-only` is a Next.js bundler shim that throws when imported in a
// client context. In Vitest we never run as a client, so make it a no-op.
vi.mock("server-only", () => ({}));

// Augment expect with jest-dom matchers when jsdom is the active env, and
// auto-cleanup mounted React trees between tests so siblings don't leak.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
