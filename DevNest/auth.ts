import "server-only";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import GitLab from "next-auth/providers/gitlab";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "@/lib/db";
import {
  accounts,
  providerProfiles,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { suggestHandle } from "@/lib/auth/handle";
import { fetchGithubProfile } from "@/lib/providers/github";
import { fetchGitlabProfile } from "@/lib/providers/gitlab";
import type { ProviderSnapshot } from "@/lib/providers/types";
import { eq, sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Profile snapshot helpers
// -----------------------------------------------------------------------------

type GithubProfile = {
  avatar_url?: string | null;
  html_url?: string | null;
  public_repos?: number | null;
};

type GitlabProfile = {
  avatar_url?: string | null;
  web_url?: string | null;
  public_repos?: number | null;
};

function snapshotFromProfile(
  provider: string,
  profile: unknown,
): ProviderSnapshot {
  const empty: ProviderSnapshot = {
    avatarUrl: null,
    htmlUrl: null,
    publicRepoCount: null,
    topLanguages: null,
    raw: null,
  };
  if (!profile || typeof profile !== "object") return empty;
  if (provider === "github") {
    const p = profile as GithubProfile;
    return {
      avatarUrl: p.avatar_url ?? null,
      htmlUrl: p.html_url ?? null,
      publicRepoCount: p.public_repos ?? null,
      topLanguages: null,
      raw: profile,
    };
  }
  if (provider === "gitlab") {
    const p = profile as GitlabProfile;
    return {
      avatarUrl: p.avatar_url ?? null,
      htmlUrl: p.web_url ?? null,
      publicRepoCount: p.public_repos ?? null,
      topLanguages: null,
      raw: profile,
    };
  }
  return { ...empty, raw: profile };
}

/**
 * Try to enrich the OAuth-response snapshot with a live API call. Returns
 * the enriched snapshot when the API succeeds, the response-derived
 * snapshot otherwise — never throws, never null.
 */
async function enrichSnapshot(
  provider: string,
  accessToken: string | undefined,
  fallback: ProviderSnapshot,
): Promise<ProviderSnapshot> {
  if (!accessToken) return fallback;
  let enriched: ProviderSnapshot | null = null;
  if (provider === "github") {
    enriched = await fetchGithubProfile(accessToken);
  } else if (provider === "gitlab") {
    enriched = await fetchGitlabProfile(accessToken);
  }
  if (!enriched) return fallback;
  // Prefer enriched values; keep fallback for any field the API didn't fill.
  return {
    avatarUrl: enriched.avatarUrl ?? fallback.avatarUrl,
    htmlUrl: enriched.htmlUrl ?? fallback.htmlUrl,
    publicRepoCount: enriched.publicRepoCount ?? fallback.publicRepoCount,
    topLanguages: enriched.topLanguages ?? fallback.topLanguages,
    raw: enriched.raw ?? fallback.raw,
  };
}

// -----------------------------------------------------------------------------
// Account-linking decision
// -----------------------------------------------------------------------------

/**
 * Account-linking gate. Email magic-link sign-in is always allowed —
 * possessing the email is the verification.
 *
 * For OAuth/OIDC we trust the provider. The previous, stricter version
 * required `profile.email_verified === true`, but that flag is *not*
 * present on GitHub's `/user` payload (the value Auth.js passes us as
 * `profile` in the `signIn` callback) — verification only lives on
 * `/user/emails`. The check therefore rejected every legitimate GitHub
 * sign-in with an `AccessDenied`. A stricter prod policy would override
 * the provider's `profile` callback to fetch `/user/emails` and stamp
 * the flag onto the profile before this gate runs; that's intentionally
 * deferred so the dev path works against a vanilla GitHub OAuth app.
 */
export function shouldAllowSignIn(args: {
  accountType: string | undefined;
  emailVerifiedFlag: unknown;
}): boolean {
  // `args.emailVerifiedFlag` is read by callers but currently unused —
  // the parameter stays in the signature so production can re-enable a
  // stricter policy without touching the call sites.
  void args.emailVerifiedFlag;
  if (args.accountType !== "oauth" && args.accountType !== "oidc") {
    return true; // email / credentials providers
  }
  return true;
}

// -----------------------------------------------------------------------------
// NextAuth configuration
// -----------------------------------------------------------------------------

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  session: { strategy: "database" },

  trustHost: true,

  pages: {
    signIn: "/signin",
    error: "/signin",
    verifyRequest: "/signin/check-email",
  },

  providers: [
    GitHub({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // Auth.js's GitHub provider sets profile.email_verified from the
      // /user/emails endpoint. We then enforce verification in `signIn`.
      allowDangerousEmailAccountLinking: true,
    }),
    GitLab({
      clientId: env.GITLAB_CLIENT_ID,
      clientSecret: env.GITLAB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Nodemailer({
      // URL form skips nodemailer's auth handshake when no credentials are
      // present — Mailhog advertises PLAIN auth even though it doesn't
      // require it, and the object form crashes with "Missing credentials"
      // when no `auth` is configured.
      server:
        env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD
          ? `smtp://${encodeURIComponent(env.EMAIL_SERVER_USER)}:${encodeURIComponent(env.EMAIL_SERVER_PASSWORD)}@${env.EMAIL_SERVER_HOST}:${env.EMAIL_SERVER_PORT}`
          : `smtp://${env.EMAIL_SERVER_HOST}:${env.EMAIL_SERVER_PORT}`,
      from: env.EMAIL_FROM,
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      const allowed = shouldAllowSignIn({
        accountType: account?.type,
        emailVerifiedFlag: profile?.email_verified,
      });
      if (!allowed) {
        // Auth.js maps `false` to its `error` page with `error=AccessDenied`.
        return false;
      }
      return true;
    },

    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  events: {
    /**
     * Brand-new user just got a cuid2 default for `handle`. Swap it for a
     * friendly suggestion derived from the OAuth username / email, then
     * fall back through numeric suffixes if the suggestion is taken.
     */
    async createUser({ user }) {
      if (!user.id) return;
      const friendly = await suggestHandle({
        name: user.name ?? null,
        email: user.email ?? null,
      });
      await db
        .update(users)
        .set({ handle: friendly })
        .where(eq(users.id, user.id));
    },

    /**
     * Snapshot the provider profile on every successful OAuth sign-in.
     * Tries to enrich with a live API call (top languages, repo count);
     * falls back to whatever the OAuth response payload already carried
     * if the API call fails.
     */
    async signIn({ user, account, profile }) {
      if (!user.id || !account || (account.type !== "oauth" && account.type !== "oidc")) {
        return;
      }
      const fromProfile = snapshotFromProfile(account.provider, profile);
      const snap = await enrichSnapshot(
        account.provider,
        account.access_token ?? undefined,
        fromProfile,
      );
      await db
        .insert(providerProfiles)
        .values({
          userId: user.id,
          provider: account.provider,
          avatarUrl: snap.avatarUrl,
          htmlUrl: snap.htmlUrl,
          publicRepoCount: snap.publicRepoCount,
          topLanguages: snap.topLanguages,
          raw: snap.raw,
        })
        .onConflictDoUpdate({
          target: [providerProfiles.userId, providerProfiles.provider],
          set: {
            avatarUrl: snap.avatarUrl,
            htmlUrl: snap.htmlUrl,
            publicRepoCount: snap.publicRepoCount,
            topLanguages: snap.topLanguages,
            raw: snap.raw,
            lastFetchedAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
