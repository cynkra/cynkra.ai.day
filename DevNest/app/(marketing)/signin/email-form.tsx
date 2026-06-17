"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Tiny client wrapper that lets the email path expand inline (no route
 * change) on the server-rendered sign-in page. The form action is the
 * server action passed from the parent; we just toggle which children
 * are visible. Both `collapsed` and `expanded` are plain JSX so the
 * server/client boundary stays clean (functions can't cross).
 */
export function EmailForm({
  action,
  expanded,
}: {
  action: (formData: FormData) => Promise<void> | void;
  expanded: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <form action={action} className="mt-3 space-y-2.5">
      {!open ? (
        <Button
          type="button"
          className="h-10 w-full"
          onClick={() => setOpen(true)}
        >
          Continue with email
        </Button>
      ) : (
        expanded
      )}
    </form>
  );
}
