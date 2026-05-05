import { type Route } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sign in to DevNest
        </h1>
        <p className="text-muted-foreground text-sm">
          OAuth is the fast path. Email is the fallback.
        </p>
      </div>

      {errorCopy ? (
        <div className="border-destructive/50 bg-destructive/5 rounded-md border p-4 text-sm">
          <p className="text-destructive font-semibold">{errorCopy.title}</p>
          <p className="text-muted-foreground mt-1">{errorCopy.body}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <form action={signInWithGithub}>
          <Button type="submit" className="w-full" variant="outline">
            Sign in with GitHub
          </Button>
        </form>
        <form action={signInWithGitlab}>
          <Button type="submit" className="w-full" variant="outline">
            Sign in with GitLab
          </Button>
        </form>
      </div>

      <div className="border-border/60 my-2 border-t" />

      <form action={signInWithEmail} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <Button type="submit" className="w-full">
          Send magic link
        </Button>
        <p className="text-muted-foreground text-xs">
          We&apos;ll email a one-time link. No password.
        </p>
      </form>
    </main>
  );
}
