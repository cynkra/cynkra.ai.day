import Link from "next/link";

import { BrandMark } from "@/components/site/brand-mark";
import { Button } from "@/components/ui/button";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-stretch justify-center gap-6 px-6 py-16">
      <div
        className="bg-card border-border space-y-4 rounded-lg border text-center"
        style={{
          padding: "48px 40px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <BrandMark size="lg" />
        <div className="space-y-1">
          <h1 className="text-[20px] font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-muted-foreground text-[13px]">
            We sent a one-time sign-in link to your inbox. It expires in a few
            minutes and works only once.
          </p>
        </div>
        <p className="text-muted-foreground text-[12px]">
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
          <Link href="/signin">Wrong email?</Link>
        </Button>
      </div>
    </main>
  );
}
