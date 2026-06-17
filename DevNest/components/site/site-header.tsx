import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { signOutAction } from "@/lib/auth/sign-out-action";

/**
 * Top-level site header. Renders different links depending on whether the
 * viewer is signed in. Sits in the root layout so EVERY page has a
 * consistent nav (the home page, sign-in, search, and explore had none
 * before this).
 */
export async function SiteHeader() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <header className="border-border/60 bg-background sticky top-0 z-30 border-b backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <Link href={signedIn ? "/feed" : "/"} className="font-semibold tracking-tight">
            DevNest
          </Link>
          {signedIn ? (
            <Link href="/feed" className="text-muted-foreground hover:underline">
              Feed
            </Link>
          ) : null}
          <Link href="/explore" className="text-muted-foreground hover:underline">
            Explore
          </Link>
          <Link href="/search" className="text-muted-foreground hover:underline">
            Search
          </Link>
          {signedIn ? (
            <Link href="/me" className="text-muted-foreground hover:underline">
              Me
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
