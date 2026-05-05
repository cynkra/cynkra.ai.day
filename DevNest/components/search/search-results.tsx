import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/follow/follow-button";
import type { SearchResults } from "@/lib/search/queries";

type Props = {
  query: string;
  results: SearchResults;
  viewer: {
    id: string | null;
    followingUserIds: Set<string>;
    followingTagIds: Set<string>;
  };
};

export function SearchResultsView({ query, results, viewer }: Props) {
  const { users, tags } = results;
  const total = users.length + tags.length;
  const authenticated = Boolean(viewer.id);

  if (!query) {
    return (
      <p className="text-muted-foreground text-sm">
        Search for developers and tags by handle, display name, or slug.
      </p>
    );
  }

  if (total === 0) {
    return (
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">People</h2>
          <p className="text-muted-foreground py-4 text-sm">
            No matches for &ldquo;{query}&rdquo;.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Tags</h2>
          <p className="text-muted-foreground py-4 text-sm">
            No matches for &ldquo;{query}&rdquo;.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section data-testid="search-people">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">People</h2>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No people match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="space-y-3">
            {users.map((user) => {
              const initials = (user.name ?? user.handle ?? "u")
                .slice(0, 2)
                .toUpperCase();
              const isSelf = viewer.id === user.id;
              return (
                <li
                  key={user.id}
                  className="border-border/60 flex items-center justify-between rounded-md border p-3"
                >
                  <Link
                    href={`/u/${user.handle}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="size-9">
                      {user.image ? (
                        <AvatarImage
                          src={user.image}
                          alt={`${user.handle} avatar`}
                        />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {user.name ?? user.handle}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        @{user.handle}
                        {user.headline ? ` · ${user.headline}` : null}
                      </p>
                    </div>
                  </Link>
                  {!isSelf ? (
                    <FollowButton
                      type="user"
                      targetId={user.id}
                      initiallyFollowing={viewer.followingUserIds.has(user.id)}
                      authenticated={authenticated}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-testid="search-tags">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Tags</h2>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tags match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="space-y-3">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="border-border/60 flex items-center justify-between rounded-md border p-3"
              >
                <Link
                  href={`/t/${tag.slug}`}
                  className="text-sm font-medium hover:underline"
                >
                  #{tag.displayName}
                </Link>
                <FollowButton
                  type="tag"
                  targetId={tag.id}
                  initiallyFollowing={viewer.followingTagIds.has(tag.id)}
                  authenticated={authenticated}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
