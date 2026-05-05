"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const isProduction = process.env.NODE_ENV === "production";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;
};

const NO_SUBSCRIBE = () => () => {};
const readRequestIdFromDom = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="x-request-id"]')
    ?.content ?? "";
const SERVER_SNAPSHOT = () => "";

/**
 * Scoped error boundary for an authenticated route group. Mirrors the
 * root `app/error.tsx` but stays inside the route group so a failure
 * in one area (e.g. `/me`) does not blank out other authenticated pages
 * (e.g. `/feed`).
 */
export function RouteError({ error, reset, scope }: RouteErrorProps) {
  const requestId = useSyncExternalStore(
    NO_SUBSCRIBE,
    readRequestIdFromDom,
    SERVER_SNAPSHOT,
  );

  useEffect(() => {
    console.error(`[${scope}]`, error);
  }, [error, scope]);

  const reference = requestId || error.digest || "no-id";

  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-12">
      <h2 className="text-2xl font-semibold tracking-tight">
        {scope} couldn&apos;t load
      </h2>
      <p className="text-muted-foreground">
        Other parts of the app are still working. You can retry below or come
        back later.
      </p>
      <code className="bg-muted rounded px-2 py-1 font-mono text-xs">
        ref: {reference}
      </code>

      {!isProduction ? (
        <details className="text-muted-foreground w-full text-sm">
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

      <Button onClick={reset} variant="secondary">
        Retry
      </Button>
    </section>
  );
}
