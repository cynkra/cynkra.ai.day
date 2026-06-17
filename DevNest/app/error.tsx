"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const isProduction = process.env.NODE_ENV === "production";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const NO_SUBSCRIBE = () => () => {};
const readRequestIdFromDom = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="x-request-id"]')
    ?.content ?? "";
const SERVER_SNAPSHOT = () => "";

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const requestId = useSyncExternalStore(
    NO_SUBSCRIBE,
    readRequestIdFromDom,
    SERVER_SNAPSHOT,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  const reference = requestId || error.digest || "no-id";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        We hit an unexpected error. Try again, or quote the reference below if
        you reach out for help.
      </p>
      <code className="bg-muted rounded px-2 py-1 font-mono text-xs">
        ref: {reference}
      </code>

      {!isProduction ? (
        <details className="text-muted-foreground w-full max-w-xl text-left text-sm">
          <summary className="cursor-pointer font-medium">
            Stack trace (dev only)
          </summary>
          <pre className="bg-muted mt-2 overflow-auto rounded p-3 font-mono text-xs whitespace-pre-wrap">
            {error.message}
            {"\n"}
            {error.stack}
          </pre>
        </details>
      ) : null}

      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
