"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { postTags, posts, tags, users } from "@/lib/db/schema";
import { renderMarkdown } from "@/lib/markdown";
import { parseTagInput } from "@/lib/tags/normalize";

// -----------------------------------------------------------------------------
// createPost
// -----------------------------------------------------------------------------

const POST_BODY_MIN = 1;
const POST_BODY_MAX = 10_000;
const MAX_TAGS = 5;

const CreatePostSchema = z.object({
  body: z
    .string()
    .min(POST_BODY_MIN, "Post body cannot be empty")
    .max(POST_BODY_MAX, `Post body must be at most ${POST_BODY_MAX} characters`)
    .refine((v) => v.trim().length > 0, "Post body cannot be only whitespace"),
  tagsInput: z.string().max(500).optional().default(""),
});

export type CreatePostState =
  | { ok: true; postId: string }
  | { ok: false; error: string; field?: "body" | "tags" | "auth" };

export async function createPostAction(
  _prev: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/feed");
  }
  const userId = session.user.id;

  const parsed = CreatePostSchema.safeParse({
    body: formData.get("body") ?? "",
    tagsInput: formData.get("tags") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      issue?.path[0] === "tagsInput"
        ? "tags"
        : issue?.path[0] === "body"
          ? "body"
          : undefined;
    return {
      ok: false,
      error: issue?.message ?? "Invalid input",
      ...(field !== undefined ? { field } : {}),
    };
  }

  const slugs = parseTagInput(parsed.data.tagsInput, MAX_TAGS);

  const { html, version } = await renderMarkdown(parsed.data.body);

  const newPostId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(posts)
      .values({
        authorId: userId,
        body: parsed.data.body,
        bodyHtml: html,
        bodyHtmlVersion: version,
      })
      .returning({ id: posts.id });

    if (!created) throw new Error("Failed to create post");

    for (const slug of slugs) {
      const [tag] = await tx
        .insert(tags)
        .values({ slug, displayName: slug })
        .onConflictDoUpdate({
          target: tags.slug,
          // self-update so RETURNING gives us the row whether inserted or matched
          set: { slug },
        })
        .returning({ id: tags.id });
      if (tag) {
        await tx
          .insert(postTags)
          .values({ postId: created.id, tagId: tag.id })
          .onConflictDoNothing();
      }
    }

    return created.id;
  });

  // Refresh the feeds and the author's profile so the new post appears.
  revalidatePath("/feed");
  revalidatePath("/explore");

  const author = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (author[0]) {
    revalidatePath(`/u/${author[0].handle}`);
  }

  return { ok: true, postId: newPostId };
}

// -----------------------------------------------------------------------------
// deletePost
// -----------------------------------------------------------------------------

export type DeletePostResult =
  | { ok: true }
  | { ok: false; error: "auth" | "not_found" | "forbidden" };

/**
 * Soft-delete a post. The author may delete; everyone else gets 403.
 * The row stays in place so referential integrity holds; feed queries
 * filter on `posts.deletedAt IS NULL` via `lib/db/posts.live()`.
 */
export async function deletePost(postId: string): Promise<DeletePostResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "auth" };
  const userId = session.user.id;

  const rows = await db
    .select({ authorId: posts.authorId, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, error: "not_found" };
  if (row.authorId !== userId) return { ok: false, error: "forbidden" };
  // Already deleted: idempotent.
  if (row.deletedAt) {
    revalidatePath("/feed");
    revalidatePath("/explore");
    return { ok: true };
  }

  await db
    .update(posts)
    .set({ deletedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.authorId, userId)));

  revalidatePath("/feed");
  revalidatePath("/explore");
  return { ok: true };
}

export type DeletePostFormState = { ok: boolean; error?: string };

export async function deletePostAction(
  _prev: DeletePostFormState,
  formData: FormData,
): Promise<DeletePostFormState> {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || !postId) {
    return { ok: false, error: "Missing post id" };
  }
  const result = await deletePost(postId);
  if (!result.ok) {
    if (result.error === "auth") {
      redirect("/signin?callbackUrl=/feed");
    }
    return {
      ok: false,
      error:
        result.error === "forbidden"
          ? "You can only delete your own posts"
          : "That post no longer exists",
    };
  }
  return { ok: true };
}
