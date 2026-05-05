import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

/**
 * Server-side guard for any code path that requires an authenticated user.
 *
 * - In an RSC, throws `UnauthenticatedError` (caught by the route group's
 *   `error.tsx` and surfaced with the request id).
 * - Pass `{ redirectTo }` to send the visitor to /signin with a callback
 *   instead of throwing — preferred for top-level pages where redirect is
 *   the user-friendly UX.
 */
export async function requireUser(opts?: {
  redirectTo?: string;
}): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    if (opts?.redirectTo) {
      const target = `/signin?callbackUrl=${encodeURIComponent(opts.redirectTo)}`;
      redirect(target);
    }
    throw new UnauthenticatedError();
  }
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}
