import Link from "next/link";
import {
  Bookmark,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Share,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostBody } from "@/components/posts/post-body";
import type { FeedPostRow } from "@/lib/feed/types";

// Pinned locale, not `undefined`: with `undefined` Node falls back to the
// server's system locale (en-US, 12-hour) while the browser uses
// `navigator.language` (often EU 24-hour), and the two strings never
// match — every <PostCard> would log a hydration mismatch. en-GB gives
// us deterministic DD-MMM-YYYY / 24h output everywhere.
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PLACEHOLDER_NAME = "Removed account";

/**
 * The single most-rendered component in the product. Quiet frame around
 * the syntax-highlighted block; padding is density-aware via the CSS
 * variable `--pad-card` set by `[data-density="…"]` on `<html>`.
 *
 * Action row buttons:
 * - Like is visual-only in MVP (no behavior wired yet — bootstrap-mvp
 *   non-goals item 7 puts interactions in a follow-up change).
 * - Comment + repost are intentionally disabled with a "coming in v0.2"
 *   tooltip, per design.md.
 */
export function PostCard({ post }: { post: FeedPostRow }) {
  const isDeletedAuthor = !post.author.handle;
  const displayName = isDeletedAuthor
    ? PLACEHOLDER_NAME
    : (post.author.name ?? post.author.handle);
  const initials = (post.author.name ?? post.author.handle ?? "u")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      className="border-border bg-card text-card-foreground border-b last:border-b-0"
      style={{ padding: "var(--pad-card)" }}
    >
      <header className="flex items-start gap-3">
        {isDeletedAuthor ? (
          <Avatar className="size-9 shrink-0">
            <AvatarFallback>—</AvatarFallback>
          </Avatar>
        ) : (
          <Link
            href={`/u/${post.author.handle}`}
            className="shrink-0"
            aria-label={`Open @${post.author.handle}'s profile`}
          >
            <Avatar className="size-9">
              {post.author.image ? (
                <AvatarImage
                  src={post.author.image}
                  alt={`@${post.author.handle} avatar`}
                />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 text-[13px] leading-tight">
            {isDeletedAuthor ? (
              <span className="text-muted-foreground font-medium">
                {displayName}
              </span>
            ) : (
              <Link
                href={`/u/${post.author.handle}`}
                className="text-foreground truncate font-medium hover:underline"
              >
                {displayName}
              </Link>
            )}
            <span className="font-mono text-[11px] text-[var(--color-ink-faint)]">
              {isDeletedAuthor ? "" : `@${post.author.handle}`}
            </span>
            <span aria-hidden className="font-mono text-[11px] text-[var(--color-ink-faint)]">
              ·
            </span>
            <time
              dateTime={post.createdAt.toISOString()}
              className="font-mono text-[11px] text-[var(--color-ink-faint)]"
            >
              {dateFormatter.format(post.createdAt)}
            </time>
          </div>
        </div>

        <button
          type="button"
          className="text-foreground/40 hover:bg-[var(--color-hover)] hover:text-foreground -mr-1 rounded p-1 transition-colors"
          aria-label="More post actions"
          title="More"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </header>

      <div className="mt-3 ml-12">
        {post.bodyHtml ? (
          <PostBody html={post.bodyHtml} />
        ) : (
          // Fallback when the cached HTML hasn't been rendered yet.
          <pre className="bg-muted overflow-auto rounded p-3 text-sm whitespace-pre-wrap">
            {post.body}
          </pre>
        )}

        <ActionRow />
      </div>
    </article>
  );
}

function ActionRow() {
  return (
    <div className="mt-3 flex items-center gap-1 text-[var(--color-ink-faint)]">
      <ActionButton icon={<Heart className="size-4" />} label="0" title="Like (v0.1)" />
      <ActionButton
        icon={<MessageSquare className="size-4" />}
        label="—"
        title="Comments coming in v0.2"
        disabled
      />
      <ActionButton
        icon={<Repeat2 className="size-4" />}
        label="—"
        title="Repost coming in v0.2"
        disabled
      />
      <div className="flex-1" />
      <ActionButton
        icon={<Bookmark className="size-4" />}
        title="Bookmarks coming in v0.2"
        disabled
      />
      <ActionButton
        icon={<Share className="size-4" />}
        title="Share coming in v0.2"
        disabled
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  title,
  disabled = false,
}: {
  icon: React.ReactNode;
  label?: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      className="hover:bg-[var(--color-hover)] hover:text-foreground inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
