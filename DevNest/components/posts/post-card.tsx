import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostBody } from "@/components/posts/post-body";
import type { FeedPostRow } from "@/lib/feed/types";

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PostCard({ post }: { post: FeedPostRow }) {
  const initials = (post.author.name ?? post.author.handle ?? "u")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="border-border/60 space-y-3 border-b py-5">
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.author.handle}`}>
          <Avatar className="size-9">
            {post.author.image ? (
              <AvatarImage
                src={post.author.image}
                alt={`${post.author.handle} avatar`}
              />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col text-sm leading-tight">
          <Link
            href={`/u/${post.author.handle}`}
            className="font-medium hover:underline"
          >
            {post.author.name ?? post.author.handle}
          </Link>
          <span className="text-muted-foreground text-xs">
            @{post.author.handle} · {formatter.format(post.createdAt)}
          </span>
        </div>
      </header>

      {post.bodyHtml ? (
        <PostBody html={post.bodyHtml} />
      ) : (
        // Fallback when the cached HTML hasn't been rendered yet.
        <pre className="bg-muted overflow-auto rounded p-3 text-sm whitespace-pre-wrap">
          {post.body}
        </pre>
      )}
    </article>
  );
}
