"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // `useOptimistic` derives the displayed value from the *current*
  // prop, with an optional optimistic override that lives only as long
  // as the surrounding transition. That means:
  //   - On click we flip locally so the user sees instant feedback.
  //   - When the parent re-fetches and re-renders with a new
  //     `initiallyFollowing` (e.g. because the rail and the profile
  //     button both reflect the same DB row), the displayed value
  //     re-syncs automatically.
  // The previous `useState(initiallyFollowing)` was load-bearing for
  // the optimistic flip but never updated when the prop changed, which
  // produced the profile-vs-rail divergence the user reported.
  const [isFollowing, setOptimistic] = useOptimistic(initiallyFollowing);

  if (!authenticated) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="/signin">Sign in to follow</a>
      </Button>
    );
  }

  const onClick = () => {
    if (pending) return;
    startTransition(async () => {
      const next = !isFollowing;
      setOptimistic(next);
      try {
        if (type === "user") {
          const r = next
            ? await followUser(targetId)
            : await unfollowUser(targetId);
          if (!r.ok) {
            toast.error(
              r.error === "self"
                ? "You can't follow yourself"
                : "Couldn't update follow",
            );
            return;
          }
        } else {
          const r = next
            ? await followTag(targetId)
            : await unfollowTag(targetId);
          if (!r.ok) {
            toast.error("Couldn't update follow");
            return;
          }
        }
        // After a successful follow/unfollow, drop the client-side
        // router cache for the current segment + its layouts. Without
        // this, the sidebar / right rail continue serving the
        // previous RSC payload when you navigate away and come back
        // via `<Link>` — the server data cache is invalidated by
        // `revalidatePath` but the browser router cache is separate.
        router.refresh();
      } catch {
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
