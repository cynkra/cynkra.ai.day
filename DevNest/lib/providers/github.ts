import "server-only";

import type { ProviderSnapshot } from "./types";

const GITHUB_API = "https://api.github.com";

const REQUEST_TIMEOUT_MS = 4000;
const REPO_SAMPLE_SIZE = 10;

type GithubUser = {
  avatar_url?: string;
  html_url?: string;
  public_repos?: number;
};

type GithubRepo = {
  name: string;
  language?: string | null;
  fork?: boolean;
  private?: boolean;
  pushed_at?: string;
};

async function ghFetch<T>(
  path: string,
  accessToken: string,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function rankLanguages(repos: GithubRepo[]): string[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.fork || repo.private) continue;
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang)
    .slice(0, 6);
}

/**
 * Fetch a normalized snapshot of a GitHub user's public profile. Returns
 * `null` on any non-2xx, network failure, or timeout — callers fall back
 * to the last persisted snapshot.
 */
export async function fetchGithubProfile(
  accessToken: string,
): Promise<ProviderSnapshot | null> {
  const user = await ghFetch<GithubUser>("/user", accessToken);
  if (!user) return null;

  // Best-effort top-languages: the recent public repos endpoint gives
  // us a primary language per repo cheaply (one API call total).
  const repos =
    (await ghFetch<GithubRepo[]>(
      `/user/repos?per_page=${REPO_SAMPLE_SIZE}&sort=pushed&visibility=public`,
      accessToken,
    )) ?? [];

  return {
    avatarUrl: user.avatar_url ?? null,
    htmlUrl: user.html_url ?? null,
    publicRepoCount: user.public_repos ?? null,
    topLanguages: repos.length > 0 ? rankLanguages(repos) : null,
    raw: { user, repos },
  };
}
