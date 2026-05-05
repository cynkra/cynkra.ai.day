import "server-only";

import type { ProviderSnapshot } from "./types";

const GITLAB_API = "https://gitlab.com/api/v4";

const REQUEST_TIMEOUT_MS = 4000;
const PROJECT_SAMPLE_SIZE = 10;

type GitlabUser = {
  id?: number;
  avatar_url?: string;
  web_url?: string;
};

type GitlabProject = {
  id: number;
  name: string;
  visibility?: "public" | "internal" | "private";
  forked_from_project?: unknown;
  language?: string | null;
};

async function glFetch<T>(
  path: string,
  accessToken: string,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${GITLAB_API}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
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

function rankLanguages(projects: GitlabProject[]): string[] {
  const counts = new Map<string, number>();
  for (const p of projects) {
    if (p.forked_from_project) continue;
    if (p.visibility !== "public") continue;
    if (!p.language) continue;
    counts.set(p.language, (counts.get(p.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang)
    .slice(0, 6);
}

/**
 * Fetch a normalized snapshot of a GitLab user's public profile. Returns
 * `null` on any non-2xx, network failure, or timeout — callers fall back
 * to the last persisted snapshot.
 */
export async function fetchGitlabProfile(
  accessToken: string,
): Promise<ProviderSnapshot | null> {
  const user = await glFetch<GitlabUser>("/user", accessToken);
  if (!user) return null;

  // GitLab's user endpoint doesn't return a project count; query it
  // separately. Visibility=public so we only count public projects.
  const projects =
    (await glFetch<GitlabProject[]>(
      `/users/${user.id}/projects?per_page=${PROJECT_SAMPLE_SIZE}&order_by=updated_at&visibility=public`,
      accessToken,
    )) ?? [];

  return {
    avatarUrl: user.avatar_url ?? null,
    htmlUrl: user.web_url ?? null,
    publicRepoCount: projects.length > 0 ? projects.length : null,
    topLanguages: projects.length > 0 ? rankLanguages(projects) : null,
    raw: { user, projects },
  };
}
