"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  type DisconnectFormState,
  disconnectProviderAction,
} from "@/lib/profile/actions";

const INITIAL_STATE: DisconnectFormState = { ok: false };

export function DisconnectForm({
  provider,
  label,
  canDisconnect,
}: {
  provider: string;
  label: string;
  canDisconnect: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    disconnectProviderAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {!state.ok && state.error ? (
          <p className="text-destructive text-xs">{state.error}</p>
        ) : null}
      </div>
      <input type="hidden" name="provider" value={provider} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending || !canDisconnect}
        title={
          !canDisconnect
            ? "You must keep at least one sign-in method"
            : undefined
        }
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
    </form>
  );
}
