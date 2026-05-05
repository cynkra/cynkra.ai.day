"use client";

import { Code2, Hash } from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  type CreatePostState,
  createPostAction,
} from "@/lib/posts/actions";

const INITIAL: CreatePostState = { ok: false, error: "" };
const POST_MAX = 10_000;
const SOFT_WARN = POST_MAX - 200;

const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "r",
  "rust",
  "go",
  "sql",
  "bash",
  "json",
  "yaml",
] as const;

type Viewer = {
  handle: string | null;
  name: string | null;
  image: string | null;
};

export function PostComposer({ viewer }: { viewer?: Viewer } = {}) {
  const [state, formAction, pending] = useActionState<
    CreatePostState,
    FormData
  >(createPostAction, INITIAL);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const langRef = useRef<HTMLSelectElement>(null);

  const [focused, setFocused] = useState(false);
  const [length, setLength] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Toast on success / error transitions; reset textarea on success.
  const lastSeenRef = useRef<CreatePostState>(INITIAL);
  useEffect(() => {
    if (state === lastSeenRef.current) return;
    if (state.ok) {
      toast.success("Posted");
      if (textareaRef.current) {
        textareaRef.current.value = "";
        setLength(0);
      }
    } else if (state.error && !state.field) {
      toast.error(state.error);
    }
    lastSeenRef.current = state;
  }, [state]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // ⌘+Enter (mac) or Ctrl+Enter (others) submits.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setFocused(false);
      setShowLangPicker(false);
      textareaRef.current?.blur();
    }
  };

  const insertCodeBlock = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lang = langRef.current?.value ?? "typescript";
    const fence = `\n\n\`\`\`${lang}\n\n\`\`\`\n`;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const newValue = before + fence + after;
    ta.value = newValue;
    setLength(newValue.length);
    // Place caret inside the empty fence.
    const caret = before.length + fence.indexOf("\n\n") + 2;
    ta.setSelectionRange(caret, caret);
    ta.focus();
    setShowLangPicker(false);
  };

  const counterTone =
    length > POST_MAX
      ? "text-[var(--color-danger)]"
      : length > SOFT_WARN
        ? "text-[var(--color-warn)]"
        : "text-[var(--color-ink-faint)]";

  const initials = (viewer?.name ?? viewer?.handle ?? "u").slice(0, 2).toUpperCase();
  const bodyId = useId();

  return (
    <form
      ref={formRef}
      action={formAction}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Keep "focused" when focus moves to a child (toolbar buttons).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          setShowLangPicker(false);
        }
      }}
      className="bg-card text-card-foreground border-border data-[focused=true]:shadow-sm border-b transition-shadow"
      data-focused={focused || length > 0}
      style={{ padding: "var(--pad-card)" }}
    >
      <div className="flex gap-3">
        <Avatar className="size-8 shrink-0">
          {viewer?.image ? (
            <AvatarImage src={viewer.image} alt="Your avatar" />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <Label htmlFor={bodyId} className="sr-only">
            Compose a post
          </Label>
          <Textarea
            ref={textareaRef}
            id={bodyId}
            name="body"
            placeholder="What's on your mind? Use ```lang for code blocks."
            rows={focused || length > 0 ? 4 : 2}
            // No `maxLength` — server-side Zod enforces the cap. Clipping
            // here would make the over-limit branch (red counter + disabled
            // Post) unreachable; cf. DEFECTS.md → D-10.
            required
            onChange={(e) => setLength(e.target.value.length)}
            onKeyDown={onKeyDown}
            aria-invalid={
              (!state.ok && state.error && state.field === "body") ||
              length > POST_MAX
                ? "true"
                : undefined
            }
            className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />

          {/* Toolbar — slides in on focus or non-empty body. */}
          <div
            className="grid transition-[grid-template-rows,opacity] duration-150 ease-out"
            style={{
              gridTemplateRows:
                focused || length > 0 ? "1fr" : "0fr",
              opacity: focused || length > 0 ? 1 : 0,
            }}
            aria-hidden={!(focused || length > 0)}
          >
            <div className="overflow-hidden">
              <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowLangPicker((s) => !s)}
                  className="hover:bg-[var(--color-hover)] inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors"
                  title="Insert code block (Cmd+K to focus)"
                >
                  <Code2 className="size-3.5" />
                  <span>Code</span>
                </button>

                {showLangPicker ? (
                  <span className="border-border bg-card flex items-center gap-1 rounded border px-1 py-0.5">
                    <select
                      ref={langRef}
                      defaultValue="typescript"
                      className="bg-transparent text-[11px] outline-none"
                      aria-label="Code block language"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={insertCodeBlock}
                      className="text-[var(--color-accent-ink)] px-1 text-[11px] font-medium"
                    >
                      Insert
                    </button>
                  </span>
                ) : null}

                <Hash className="ml-2 size-3.5 text-[var(--color-ink-faint)]" />
                <Input
                  name="tags"
                  placeholder="typescript, react (max 5)"
                  maxLength={500}
                  className="h-7 max-w-[280px] flex-1 border-0 bg-transparent text-[12px] shadow-none focus-visible:ring-0"
                />

                <div className="ml-auto flex items-center gap-3">
                  <span
                    aria-live="polite"
                    className={`font-mono text-[11px] ${counterTone}`}
                  >
                    {length}/{POST_MAX}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pending || length === 0 || length > POST_MAX}
                  >
                    {pending ? "Posting…" : "Post"}
                  </Button>
                </div>
              </div>

              {!state.ok && state.error ? (
                <p className="text-destructive mt-2 text-xs">{state.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
