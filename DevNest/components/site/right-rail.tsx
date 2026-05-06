import Link from "next/link";
import { Search } from "lucide-react";

import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/follow/follow-button";
import { getFollowSuggestions } from "@/lib/follow/suggestions";
import { getTrendingTags } from "@/lib/tags/trending";

const SHORTCUTS = [
  ["g h", "Home"],
  ["g e", "Explore"],
  ["⌘K", "Search"],
  ["⌘↩", "Post"],
];

/**
 * Three-column layout's right rail. Hidden under data-layout="single|two"
 * via CSS (the column width var collapses to 0). Fetches trending tags
 * and follow suggestions concurrently and renders four stacked panels.
 */
export async function RightRail({ authenticated }: { authenticated: boolean }) {
  const session = authenticated ? await auth() : null;
  const viewerId = session?.user?.id ?? null;

  const [trending, suggestions] = await Promise.all([
    getTrendingTags(5).catch(() => []),
    getFollowSuggestions(viewerId, 3).catch(() => []),
  ]);

  return (
    <aside
      className="border-border bg-background sticky top-0 hidden h-screen flex-col gap-3 overflow-y-auto border-l p-4 lg:flex"
      style={{ width: "var(--col-side)" }}
      aria-label="Discover"
    >
      <form action="/search" className="bg-card border-border flex items-center gap-2 rounded border px-2 py-1.5">
        <Search className="text-[var(--color-ink-faint)] size-3.5" />
        <input
          id="global-search"
          type="search"
          name="q"
          placeholder="Search"
          className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--color-ink-faint)]"
          aria-label="Search developers and tags"
        />
        <kbd className="text-[var(--color-ink-faint)] font-mono text-[11px]">⌘K</kbd>
      </form>

      <Panel title="Trending">
        {trending.length === 0 ? (
          <Empty text="No trends yet — be the first to post." />
        ) : (
          <ol className="space-y-2.5">
            {trending.map((tag, idx) => (
              <li key={tag.id} className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-[var(--color-ink-faint)] tabular-nums">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <Link
                  href={`/t/${tag.slug}`}
                  className="text-foreground text-[13px] hover:underline"
                >
                  #{tag.displayName}
                </Link>
                <span className="ml-auto font-mono text-[11px] text-[var(--color-ink-faint)]">
                  {tag.postCount}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Who to follow">
        {suggestions.length === 0 ? (
          <Empty text="No suggestions yet." />
        ) : (
          <ul className="space-y-3">
            {suggestions.map((user) => {
              const initials = (user.name ?? user.handle).slice(0, 2).toUpperCase();
              return (
                <li key={user.id} className="flex items-start gap-2">
                  <Link href={`/u/${user.handle}`} aria-label={`@${user.handle}`}>
                    <Avatar className="size-8">
                      {user.image ? (
                        <AvatarImage src={user.image} alt={`@${user.handle}`} />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${user.handle}`}
                      className="block truncate text-[13px] font-medium hover:underline"
                    >
                      {user.name ?? user.handle}
                    </Link>
                    <span className="font-mono text-[11px] text-[var(--color-ink-faint)] block truncate">
                      @{user.handle}
                    </span>
                    {user.headline ? (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[12px]">
                        {user.headline}
                      </p>
                    ) : null}
                  </div>
                  <FollowButton
                    type="user"
                    targetId={user.id}
                    initiallyFollowing={user.isFollowing}
                    authenticated={authenticated}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Shortcuts">
        <ul className="space-y-1.5">
          {SHORTCUTS.map(([combo, label]) => (
            <li
              key={combo}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="text-muted-foreground">{label}</span>
              <kbd className="bg-muted font-mono text-[11px] rounded px-1.5 py-0.5">
                {combo}
              </kbd>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-auto pb-2">
        <p className="text-[var(--color-ink-faint)] flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px]">
          <span>terms</span>
          <span aria-hidden>·</span>
          <span>privacy</span>
          <span aria-hidden>·</span>
          <span>status</span>
        </p>
      </div>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border-border rounded border p-3">
      <h2 className="text-muted-foreground mb-2 text-[12px] font-semibold uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground text-[12px] italic">
      {text}
    </p>
  );
}
