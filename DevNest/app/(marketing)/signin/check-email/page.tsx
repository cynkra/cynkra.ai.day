import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="text-muted-foreground">
        We sent a one-time sign-in link to your inbox. It expires in a few
        minutes and works only once.
      </p>
      <p className="text-muted-foreground text-sm">
        In local development the link lands in{" "}
        <a
          href="http://localhost:8025"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Mailhog
        </a>
        .
      </p>
      <Button asChild variant="ghost">
        <Link href="/signin">Back to sign in</Link>
      </Button>
    </main>
  );
}
