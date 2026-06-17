"use server";

import { signOut } from "@/auth";

/**
 * Sign-out server action: deletes the current `sessions` row (Auth.js
 * does this when `session.strategy === "database"`), clears the session
 * cookie via the response, and redirects to `/`.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
