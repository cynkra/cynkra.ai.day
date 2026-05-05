"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  type CreatePostState,
  createPostAction,
} from "@/lib/posts/actions";

// "use server" files can only export async functions, so the initial
// state lives here on the client side instead.
const INITIAL: CreatePostState = { ok: false, error: "" };

export function PostComposer() {
  const [state, formAction, pending] = useActionState<
    CreatePostState,
    FormData
  >(createPostAction, INITIAL);

  // Toast on success / error transitions. The inline error stays for the
  // user who's looking at the form; the toast covers the case where the
  // author has scrolled down already.
  const lastSeenStateRef = useRef<CreatePostState>(INITIAL);
  useEffect(() => {
    if (state === lastSeenStateRef.current) return;
    if (state.ok) {
      toast.success("Posted");
    } else if (state.error && !state.field) {
      // Field-level errors are already shown inline next to the field.
      toast.error(state.error);
    }
    lastSeenStateRef.current = state;
  }, [state]);

  return (
    <form
      action={formAction}
      className="border-border/60 space-y-3 rounded-md border p-4"
      // Reset the textarea after a successful submit. The keyed wrapper
      // forces React to remount the children when `state.ok` flips true.
      key={state.ok ? `posted-${"postId" in state ? state.postId : ""}` : "draft"}
    >
      <Label htmlFor="post-body" className="sr-only">
        Compose a post
      </Label>
      <Textarea
        id="post-body"
        name="body"
        placeholder="Share something with code… ```ts ``` blocks render."
        rows={4}
        maxLength={10000}
        required
        aria-invalid={
          !state.ok && state.error && state.field === "body" ? "true" : undefined
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          name="tags"
          placeholder="Tags: typescript, react (max 5)"
          maxLength={500}
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
      {!state.ok && state.error ? (
        <p className="text-destructive text-xs">{state.error}</p>
      ) : null}
    </form>
  );
}
