import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        DevNest
      </h1>
      <p className="text-muted-foreground max-w-md text-lg">
        A social network for software developers. Share posts with code,
        follow tags and people, see what your peers are building.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">Browse the discovery feed</Link>
        </Button>
      </div>
    </main>
  );
}
