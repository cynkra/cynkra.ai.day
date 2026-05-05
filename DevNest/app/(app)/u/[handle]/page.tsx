import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedList } from "@/components/posts/feed-list";
import { FollowButton } from "@/components/follow/follow-button";
import { ProviderPanel } from "@/components/profile/provider-panel";
import { getProfileFeed } from "@/lib/feed/profile";
import { loadMoreProfileFeed } from "@/lib/feed/load-more-actions";
import { getFollowCounts } from "@/lib/follow/counts";
import { isFollowingUser } from "@/lib/follow/queries";
import { getProfileByHandle } from "@/lib/profile/queries";

const PROVIDER_BADGE_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle).toLowerCase();

  const result = await getProfileByHandle(handle);
  if (!result.found) notFound();

  const { user, linkedProviders, providerSnapshots } = result.profile;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isOwnProfile = viewerId === user.id;

  const [initialPosts, counts, viewerFollows] = await Promise.all([
    getProfileFeed(user.id, null),
    getFollowCounts(user.id),
    viewerId && !isOwnProfile
      ? isFollowingUser(viewerId, user.id)
      : Promise.resolve(false),
  ]);

  const userId = user.id;
  const loadMore = async (cursor: string) => {
    "use server";
    return loadMoreProfileFeed(userId, cursor);
  };

  const initials = (user.name ?? user.handle ?? "u").slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-start">
        <Avatar className="size-20">
          {user.image ? (
            <AvatarImage src={user.image} alt={`${user.handle} avatar`} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {user.name ?? user.handle}
              </h1>
              <p className="text-muted-foreground text-sm">@{user.handle}</p>
            </div>
            {!isOwnProfile ? (
              <FollowButton
                type="user"
                targetId={user.id}
                initiallyFollowing={viewerFollows}
                authenticated={Boolean(viewerId)}
              />
            ) : null}
          </div>
          {user.headline ? (
            <p className="text-base">{user.headline}</p>
          ) : null}
          <div className="text-muted-foreground flex gap-4 text-sm">
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
                  className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs"
                >
                  {PROVIDER_BADGE_LABEL[p.provider] ?? p.provider}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {user.bio ? (
        <p className="mt-6 max-w-prose text-base leading-relaxed">
          {user.bio}
        </p>
      ) : null}

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Connected accounts
        </h2>
        <ProviderPanel snapshots={providerSnapshots} />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Posts</h2>
        <FeedList
          key={initialPosts.posts[0]?.id ?? "empty"}
          initial={initialPosts}
          loadMore={loadMore}
          emptyState={
            <p className="text-muted-foreground py-6 text-sm">No posts yet.</p>
          }
        />
      </section>
    </main>
  );
}
