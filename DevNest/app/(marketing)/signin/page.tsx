import { type Route } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { BrandMark } from "@/components/site/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { EmailForm } from "./email-form";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "We couldn't verify that account",
    body: "Your OAuth provider hasn't confirmed the email on your account. Sign in with the method you used originally, then connect this provider from settings.",
  },
  OAuthAccountNotLinked: {
    title: "Email already in use",
    body: "An account with this email already exists. Sign in with your original method first, then connect this provider from settings.",
  },
  Verification: {
    title: "Magic link expired or already used",
    body: "Magic links work once and expire after a short window. Request a new one below.",
  },
  Configuration: {
    title: "Sign-in is misconfigured",
    body: "This usually means the OAuth credentials aren't set yet. Tell the operator to check the server logs.",
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = (params.callbackUrl ?? "/feed") as Route;
  const errorCopy = error ? ERROR_COPY[error] : undefined;

  async function signInWithGithub() {
    "use server";
    await signIn("github", { redirectTo: callbackUrl });
  }

  async function signInWithGitlab() {
    "use server";
    await signIn("gitlab", { redirectTo: callbackUrl });
  }

  async function signInWithEmail(formData: FormData) {
    "use server";
    const email = formData.get("email");
    if (typeof email !== "string" || !email.includes("@")) {
      redirect(`/signin?error=Configuration`);
    }
    await signIn("nodemailer", { email, redirectTo: callbackUrl });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-stretch justify-center gap-6 px-6 py-16">
      <div
        className="bg-card border-border rounded-lg border"
        style={{
          padding: "48px 40px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <header className="space-y-3 text-center">
          <BrandMark size="lg" />
          <div className="space-y-1">
            <h1 className="text-[20px] font-semibold tracking-tight">
              Sign in to DevNest
            </h1>
            <p className="text-muted-foreground text-[13px]">
              for software developers.
            </p>
          </div>
        </header>

        {errorCopy ? (
          <div
            role="alert"
            aria-live="polite"
            className="border-destructive/50 bg-destructive/5 mt-6 rounded-md border p-3 text-[12px]"
          >
            <p className="text-destructive font-semibold">{errorCopy.title}</p>
            <p className="text-muted-foreground mt-1">{errorCopy.body}</p>
          </div>
        ) : null}

        <div className="mt-7 grid gap-2.5">
          <form action={signInWithGithub}>
            <Button type="submit" className="h-10 w-full" variant="outline">
              Continue with GitHub
            </Button>
          </form>
          <form action={signInWithGitlab}>
            <Button type="submit" className="h-10 w-full" variant="outline">
              Continue with GitLab
            </Button>
          </form>
        </div>

        <EmailForm
          action={signInWithEmail}
          expanded={
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[12px]">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              <Button type="submit" className="h-10 w-full">
                Send magic link
              </Button>
              <p className="text-muted-foreground text-[11px]">
                A one-time sign-in link, no password.
              </p>
            </div>
          }
        />
      </div>

      <p className="text-[var(--color-ink-faint)] flex justify-center gap-2 font-mono text-[11px]">
        <span>terms</span>
        <span aria-hidden>·</span>
        <span>privacy</span>
        <span aria-hidden>·</span>
        <span>status</span>
      </p>
    </main>
  );
}
