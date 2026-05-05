"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ProfileFormState,
  updateProfile,
} from "@/lib/profile/actions";

const INITIAL_STATE: ProfileFormState = { ok: false };

export function ProfileForm({
  initial,
}: {
  initial: {
    handle: string;
    name: string;
    headline: string;
    bio: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    INITIAL_STATE,
  );

  const fieldError = (field: ProfileFormState["field"]) =>
    !state.ok && state.field === field ? state.error : null;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="handle">Handle</Label>
        <Input
          id="handle"
          name="handle"
          defaultValue={initial.handle}
          required
          minLength={3}
          maxLength={32}
          autoComplete="off"
          aria-invalid={fieldError("handle") ? "true" : undefined}
          aria-describedby={fieldError("handle") ? "handle-error" : undefined}
        />
        <p className="text-muted-foreground text-xs">
          3–32 characters, lowercase letters, numbers, and underscores. Used
          as <code className="font-mono">/u/{initial.handle || "your-handle"}</code>.
        </p>
        {fieldError("handle") ? (
          <p id="handle-error" className="text-destructive text-xs">
            {fieldError("handle")}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name}
          maxLength={80}
          autoComplete="name"
        />
        {fieldError("name") ? (
          <p className="text-destructive text-xs">{fieldError("name")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          name="headline"
          defaultValue={initial.headline}
          maxLength={120}
          placeholder="One line about you"
        />
        {fieldError("headline") ? (
          <p className="text-destructive text-xs">{fieldError("headline")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio}
          maxLength={500}
          rows={4}
        />
        {fieldError("bio") ? (
          <p className="text-destructive text-xs">{fieldError("bio")}</p>
        ) : null}
      </div>

      {!state.ok && state.error && !state.field ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Profile saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
