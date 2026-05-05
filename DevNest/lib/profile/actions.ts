"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { isHandleAvailable, validateHandle } from "@/lib/auth/handle";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";

// -----------------------------------------------------------------------------
// updateProfile
// -----------------------------------------------------------------------------

const ProfileInputSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(32, "Handle must be at most 32 characters"),
  name: z
    .string()
    .max(80, "Display name must be at most 80 characters")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : "")),
  headline: z
    .string()
    .max(120, "Headline must be at most 120 characters")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .max(500, "Bio must be at most 500 characters")
    .optional()
    .or(z.literal("")),
});

export type ProfileFormState = {
  ok: boolean;
  error?: string;
  field?: "handle" | "name" | "headline" | "bio" | "auth";
};

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not signed in", field: "auth" };
  }
  const userId = session.user.id;

  const parsed = ProfileInputSchema.safeParse({
    handle: formData.get("handle") ?? "",
    name: formData.get("name") ?? "",
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = (issue?.path[0] as ProfileFormState["field"]) ?? undefined;
    return {
      ok: false,
      error: issue?.message ?? "Invalid input",
      ...(field !== undefined ? { field } : {}),
    };
  }

  // Handle: format + reserved + uniqueness
  const validation = validateHandle(parsed.data.handle);
  if (!validation.ok) {
    return {
      ok: false,
      field: "handle",
      error:
        validation.reason === "reserved"
          ? "That handle is reserved"
          : "Handle must be 3–32 characters of [a-z0-9_]",
    };
  }
  const available = await isHandleAvailable(validation.handle, userId);
  if (!available) {
    return { ok: false, field: "handle", error: "Handle already taken" };
  }

  await db
    .update(users)
    .set({
      handle: validation.handle,
      name: parsed.data.name || null,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Revalidate the profile page so the new data is visible immediately.
  revalidatePath(`/u/${validation.handle}`);
  revalidatePath("/me/settings");

  return { ok: true };
}

// -----------------------------------------------------------------------------
// disconnectProvider
// -----------------------------------------------------------------------------

export type DisconnectResult =
  | { ok: true }
  | { ok: false; error: "auth" | "last_method" | "not_linked" };

/**
 * Disconnect an OAuth provider from the current user. Refuses when this
 * would leave the user with zero linked OAuth accounts (per spec —
 * email magic-link as the sole sign-in method is treated as too fragile
 * to be the only option once OAuth is in use).
 */
export async function disconnectProvider(
  provider: string,
): Promise<DisconnectResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "auth" };
  const userId = session.user.id;

  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  if (!linked.find((a) => a.provider === provider)) {
    return { ok: false, error: "not_linked" };
  }
  if (linked.length <= 1) {
    return { ok: false, error: "last_method" };
  }

  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));

  revalidatePath("/me/settings");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Form-state wrapper for disconnectProvider so it can be used with
// useFormState in the settings UI.
// -----------------------------------------------------------------------------

export type DisconnectFormState = { ok: boolean; error?: string };

export async function disconnectProviderAction(
  _prev: DisconnectFormState,
  formData: FormData,
): Promise<DisconnectFormState> {
  const provider = formData.get("provider");
  if (typeof provider !== "string") {
    return { ok: false, error: "Missing provider" };
  }
  const result = await disconnectProvider(provider);
  if (!result.ok) {
    if (result.error === "last_method") {
      return {
        ok: false,
        error:
          "You can't disconnect your only sign-in method. Add another first.",
      };
    }
    if (result.error === "auth") {
      redirect("/signin?callbackUrl=/me/settings");
    }
    return { ok: false, error: "That provider isn't linked" };
  }
  return { ok: true };
}

