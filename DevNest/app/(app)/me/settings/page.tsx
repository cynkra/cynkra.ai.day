import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import {
  PREFS_COOKIE,
  parsePreferences,
} from "@/lib/preferences/cookie";

import { DisconnectForm } from "./disconnect-form";
import { PreferencesForm } from "./preferences-form";
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

  const store = await cookies();
  const prefs = parsePreferences(store.get(PREFS_COOKIE)?.value);

  return (
    <div className="space-y-12 px-1 py-6">
      <header className="space-y-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-[13px]">
          Profile, sign-in methods, and how the UI looks.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-[14px] font-semibold tracking-tight">Profile</h2>
        <ProfileForm
          initial={{
            handle: user.handle,
            name: user.name ?? "",
            headline: user.headline ?? "",
            bio: user.bio ?? "",
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-[14px] font-semibold tracking-tight">
          Sign-in methods
        </h2>
        {linked.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            No OAuth providers linked. You sign in via email magic link only.
          </p>
        ) : (
          <ul className="divide-border/60 border-border divide-y rounded-md border">
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

      <section className="space-y-4">
        <h2 className="text-[14px] font-semibold tracking-tight">
          Appearance &amp; layout
        </h2>
        <PreferencesForm initial={prefs} />
      </section>
    </div>
  );
}
