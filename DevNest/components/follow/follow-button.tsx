"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  followTag,
  followUser,
  unfollowTag,
  unfollowUser,
} from "@/lib/follow/actions";

type Props = {
  /**
   * Either "user" (id is users.id) or "tag" (id is tags.id). Drives which
   * pair of server actions we invoke.
   */
  type: "user" | "tag";
  targetId: string;
  initiallyFollowing: boolean;
  /**
   * When false, the button is disabled with a sign-in tooltip — used
   * for the search page where we need a follow control even for
   * unauthenticated viewers.
   */
  authenticated?: boolean;
};

export function FollowButton({
  type,
  targetId,
  initiallyFollowing,
  authenticated = true,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="/signin">Sign in to follow</a>
      </Button>
    );
  }

  const onClick = () => {
    if (pending) return;
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    startTransition(async () => {
      try {
        if (type === "user") {
          const r = optimistic
            ? await followUser(targetId)
            : await unfollowUser(targetId);
          if (!r.ok) {
            setIsFollowing(!optimistic);
            toast.error(
              r.error === "self"
                ? "You can't follow yourself"
                : "Couldn't update follow",
            );
          }
        } else {
          const r = optimistic
            ? await followTag(targetId)
            : await unfollowTag(targetId);
          if (!r.ok) {
            setIsFollowing(!optimistic);
            toast.error("Couldn't update follow");
          }
        }
      } catch {
        setIsFollowing(!optimistic);
        toast.error("Couldn't update follow");
      }
    });
  };

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
