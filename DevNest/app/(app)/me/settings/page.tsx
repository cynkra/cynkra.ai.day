import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/require-user";

import { DisconnectForm } from "./disconnect-form";
import { ProfileForm } from "./profile-form";

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

export default async function SettingsPage() {
  const sessionUser = await requireUser({ redirectTo: "/me/settings" });

  const [user] = await db
    .select({
      handle: users.handle,
      name: users.name,
      headline: users.headline,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!user) {
    // Session points at a deleted user. Send them to sign-in to clean up.
    redirect("/signin");
  }

  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, sessionUser.id));

  const canDisconnect = linked.length > 1;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Edit your public profile and manage connected sign-in methods.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <ProfileForm
          initial={{
            handle: user.handle,
            name: user.name ?? "",
            headline: user.headline ?? "",
            bio: user.bio ?? "",
          }}
        />
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Sign-in methods
        </h2>
        {linked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No OAuth providers linked. You sign in via email magic link only.
          </p>
        ) : (
          <ul className="divide-border/60 divide-y rounded-md border">
            {linked.map((a) => (
              <li key={a.provider} className="px-4 py-3">
                <DisconnectForm
                  provider={a.provider}
                  label={PROVIDER_LABEL[a.provider] ?? a.provider}
                  canDisconnect={canDisconnect}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
