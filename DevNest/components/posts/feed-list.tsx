"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import type { FeedPage, FeedPostRow } from "@/lib/feed/types";

type LoadMore = (cursor: string) => Promise<FeedPage>;

export function FeedList({
  initial,
  loadMore,
  emptyState,
}: {
  initial: FeedPage;
  loadMore: LoadMore;
  emptyState?: React.ReactNode;
}) {
  const [items, setItems] = useState<FeedPostRow[]>(initial.posts);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onLoadMore = () => {
    if (!cursor || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await loadMore(cursor);
        setItems((prev) => [...prev, ...next.posts]);
        setCursor(next.nextCursor);
      } catch {
        setError("Couldn't load more right now.");
      }
    });
  };

  if (items.length === 0) {
    return emptyState ?? (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Nothing here yet.
      </p>
    );
  }

  return (
    <div>
      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {cursor ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={pending}
          >
            {pending ? "Loading…" : "Load more"}
          </Button>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
      ) : (
        <p className="text-muted-foreground py-6 text-center text-xs">
          You&apos;re all caught up.
        </p>
      )}
    </div>
  );
}
