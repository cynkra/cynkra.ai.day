import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Snapshot = {
  provider: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  publicRepoCount: number | null;
  topLanguages: string[] | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

/**
 * Renders a "from GitHub" / "from GitLab" panel with the snapshot we
 * captured at sign-in (or last refresh). Falls back to last-known data
 * silently when fresh fetches fail; the page just shows what we have.
 */
export function ProviderPanel({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {snapshots.map((s) => {
        const label = PROVIDER_LABEL[s.provider] ?? s.provider;
        return (
          <Card key={s.provider}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>From {label}</span>
                {s.htmlUrl ? (
                  <Link
                    href={s.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground text-xs hover:underline"
                  >
                    Open ↗
                  </Link>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {typeof s.publicRepoCount === "number" ? (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Public repos</span>
                  <span className="font-medium">{s.publicRepoCount}</span>
                </div>
              ) : null}
              {s.topLanguages && s.topLanguages.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Top languages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.topLanguages.slice(0, 6).map((lang) => (
                      <span
                        key={lang}
                        className="bg-muted rounded px-2 py-0.5 text-xs"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {!s.publicRepoCount &&
              (!s.topLanguages || s.topLanguages.length === 0) ? (
                <p className="text-muted-foreground text-xs italic">
                  Snapshot pending — sign back in to refresh.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
