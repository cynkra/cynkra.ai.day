"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getDiscoveryFeed } from "@/lib/feed/discovery";
import { getHomeFeed } from "@/lib/feed/home";
import { getProfileFeed } from "@/lib/feed/profile";
import { getTagFeed } from "@/lib/feed/tag";
import type { FeedPage } from "@/lib/feed/types";

export async function loadMoreHomeFeed(cursor: string): Promise<FeedPage> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/feed");
  }
  return getHomeFeed(session.user.id, cursor);
}

export async function loadMoreDiscoveryFeed(cursor: string): Promise<FeedPage> {
  return getDiscoveryFeed(cursor);
}

export async function loadMoreProfileFeed(
  userId: string,
  cursor: string,
): Promise<FeedPage> {
  return getProfileFeed(userId, cursor);
}

export async function loadMoreTagFeed(
  tagId: string,
  cursor: string,
): Promise<FeedPage> {
  return getTagFeed(tagId, cursor);
}
