"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { follows, tagFollows, tags, users } from "@/lib/db/schema";

export type FollowResult =
  | { ok: true }
  | { ok: false; error: "auth" | "self" | "not_found" };

// -----------------------------------------------------------------------------
// User follows
// -----------------------------------------------------------------------------

export async function followUser(targetUserId: string): Promise<FollowResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const followerId = session.user.id;
  if (followerId === targetUserId) return { ok: false, error: "self" };

  const target = await db
    .select({ id: users.id, handle: users.handle, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target[0] || target[0].deletedAt) {
    return { ok: false, error: "not_found" };
  }

  await db
    .insert(follows)
    .values({ followerId, targetUserId })
    .onConflictDoNothing();

  revalidatePath(`/u/${target[0].handle}`);
  revalidatePath("/feed");
  return { ok: true };
}

export async function unfollowUser(
  targetUserId: string,
): Promise<FollowResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const followerId = session.user.id;

  const target = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.targetUserId, targetUserId),
      ),
    );

  if (target[0]) revalidatePath(`/u/${target[0].handle}`);
  revalidatePath("/feed");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Tag follows
// -----------------------------------------------------------------------------

export async function followTag(tagId: string): Promise<FollowResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const userId = session.user.id;

  const tag = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);
  if (!tag[0]) return { ok: false, error: "not_found" };

  await db
    .insert(tagFollows)
    .values({ userId, tagId })
    .onConflictDoNothing();

  revalidatePath(`/t/${tag[0].slug}`);
  revalidatePath("/feed");
  return { ok: true };
}

export async function unfollowTag(tagId: string): Promise<FollowResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const userId = session.user.id;

  const tag = await db
    .select({ slug: tags.slug })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);

  await db
    .delete(tagFollows)
    .where(and(eq(tagFollows.userId, userId), eq(tagFollows.tagId, tagId)));

  if (tag[0]) revalidatePath(`/t/${tag[0].slug}`);
  revalidatePath("/feed");
  return { ok: true };
}
