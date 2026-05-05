import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { getProfileFeed } from "@/lib/feed/profile";
import { loadMoreProfileFeed } from "@/lib/feed/load-more-actions";
import { getFollowCounts } from "@/lib/follow/counts";
import { isFollowingUser } from "@/lib/follow/queries";
import { getProfileByHandle } from "@/lib/profile/queries";

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
  const isOwn = viewerId === user.id;

  const [initialPosts, counts, viewerFollows] = await Promise.all([
    getProfileFeed(user.id, null),
    getFollowCounts(user.id),
    viewerId && !isOwn
      ? isFollowingUser(viewerId, user.id)
      : Promise.resolve(false),
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
      mode={isOwn ? "owned" : "visited"}
      viewerFollows={viewerFollows}
      authenticated={Boolean(viewerId)}
    />
  );
}
