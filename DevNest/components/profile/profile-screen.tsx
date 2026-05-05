import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FeedList } from "@/components/posts/feed-list";
import { FollowButton } from "@/components/follow/follow-button";
import { ProviderPanel } from "@/components/profile/provider-panel";
import type { FeedPage } from "@/lib/feed/types";

const PROVIDER_BADGE_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

type ProfileViewProps = {
  user: {
    id: string;
    handle: string;
    name: string | null;
    image: string | null;
    headline: string | null;
    bio: string | null;
  };
  linkedProviders: { provider: string }[];
  providerSnapshots: {
    provider: string;
    avatarUrl: string | null;
    htmlUrl: string | null;
    publicRepoCount: number | null;
    topLanguages: string[] | null;
  }[];
  counts: { followers: number; following: number };
  initialPosts: FeedPage;
  loadMore: (cursor: string) => Promise<FeedPage>;
  /**
   * "owned": viewer is looking at their own profile — shows "Edit profile".
   * "visited": viewer is a different user (or unauthenticated) — shows
   *   the Follow button.
   */
  mode: "owned" | "visited";
  /** When mode === "visited" and viewer is signed in, used to label the button. */
  viewerFollows: boolean;
  /** When false, FollowButton renders the "Sign in to follow" affordance. */
  authenticated: boolean;
};

export function ProfileScreen({
  user,
  linkedProviders,
  providerSnapshots,
  counts,
  initialPosts,
  loadMore,
  mode,
  viewerFollows,
  authenticated,
}: ProfileViewProps) {
  const initials = (user.name ?? user.handle ?? "u").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-5">
        <Avatar className="size-20 shrink-0">
          {user.image ? (
            <AvatarImage src={user.image} alt={`@${user.handle} avatar`} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-[20px] font-semibold leading-tight tracking-tight">
                {user.name ?? user.handle}
              </h1>
              <p className="text-[var(--color-ink-faint)] font-mono text-[13px]">
                @{user.handle}
              </p>
            </div>
            {mode === "owned" ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/me/settings">Edit profile</Link>
              </Button>
            ) : (
              <FollowButton
                type="user"
                targetId={user.id}
                initiallyFollowing={viewerFollows}
                authenticated={authenticated}
              />
            )}
          </div>

          {user.headline ? (
            <p className="text-muted-foreground font-mono text-[13px]">
              {user.headline}
            </p>
          ) : null}
          {user.bio ? (
            <p className="max-w-prose text-[13px] leading-relaxed">
              {user.bio}
            </p>
          ) : null}
          <div className="text-muted-foreground flex gap-4 text-[13px]">
            <span>
              <strong className="text-foreground">{counts.followers}</strong>{" "}
              {counts.followers === 1 ? "Follower" : "Followers"}
            </span>
            <span>
              <strong className="text-foreground">{counts.following}</strong>{" "}
              Following
            </span>
          </div>
          {linkedProviders.length > 0 ? (
            <div className="flex gap-1.5 pt-1">
              {linkedProviders.map((p) => (
                <span
                  key={p.provider}
                  className="bg-muted text-muted-foreground font-mono rounded px-2 py-0.5 text-[11px] uppercase tracking-wide"
                >
                  {PROVIDER_BADGE_LABEL[p.provider] ?? p.provider}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {providerSnapshots.length > 0 ? (
        <ProviderPanel snapshots={providerSnapshots} />
      ) : null}

      <Tabs activeTab="posts" />

      <section>
        <FeedList
          // Re-key on the newest post so a freshly-created post causes the
          // list to remount (avoids stale local state in <FeedList>).
          key={initialPosts.posts[0]?.id ?? "empty"}
          initial={initialPosts}
          loadMore={loadMore}
          emptyState={
            <p className="text-muted-foreground py-12 text-center text-[13px]">
              @{user.handle} hasn&apos;t posted yet.
            </p>
          }
        />
      </section>
    </div>
  );
}

function Tabs({ activeTab }: { activeTab: "posts" | "replies" | "likes" }) {
  return (
    <nav className="border-border -mb-px flex gap-6 border-b text-[13px]">
      <TabLink label="Posts" active={activeTab === "posts"} />
      <TabLink label="Replies" disabled />
      <TabLink label="Likes" disabled />
    </nav>
  );
}

function TabLink({
  label,
  active = false,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const className = [
    "relative pb-2 transition-colors",
    active
      ? "text-foreground font-medium"
      : disabled
        ? "text-muted-foreground/60 cursor-not-allowed"
        : "text-muted-foreground hover:text-foreground",
  ].join(" ");
  return (
    <span
      className={className}
      title={disabled ? "Coming in v0.2" : undefined}
      aria-disabled={disabled}
    >
      {label}
      {active ? (
        <span
          aria-hidden
          className="bg-[var(--color-accent)] absolute -bottom-px left-0 right-0 h-0.5"
        />
      ) : null}
    </span>
  );
}
