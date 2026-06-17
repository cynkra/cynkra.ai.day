import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ProfileScreen } from "@/components/profile/profile-screen";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getProfileFeed } from "@/lib/feed/profile";
import { loadMoreProfileFeed } from "@/lib/feed/load-more-actions";
import { getFollowCounts } from "@/lib/follow/counts";
import { getProfileByHandle } from "@/lib/profile/queries";

/**
 * Current-user profile. Reuses <ProfileScreen> in `mode="owned"` so the
 * markup is identical to `/u/[handle]` — only the action button swaps
 * (Edit profile vs Follow).
 */
export default async function MePage() {
  const sessionUser = await requireUser({ redirectTo: "/me" });

  const [row] = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  if (!row) {
    // Session points at a deleted user. Clean up by sending them to
    // sign-in. `redirect()` throws so TypeScript knows control doesn't
    // continue past it.
    redirect("/signin");
  }

  const result = await getProfileByHandle(row.handle);
  if (!result.found) {
    redirect("/signin");
  }

  const { user, linkedProviders, providerSnapshots } = result.profile;
  const [initialPosts, counts] = await Promise.all([
    getProfileFeed(user.id, null),
    getFollowCounts(user.id),
  ]);

  const userId = user.id;
  const loadMore = async (cursor: string) => {
    "use server";
    return loadMoreProfileFeed(userId, cursor);
  };

  return (
    <ProfileScreen
      user={user}
      linkedProviders={linkedProviders}
      providerSnapshots={providerSnapshots}
      counts={counts}
      initialPosts={initialPosts}
      loadMore={loadMore}
      mode="owned"
      viewerFollows={false}
      authenticated
    />
  );
}
