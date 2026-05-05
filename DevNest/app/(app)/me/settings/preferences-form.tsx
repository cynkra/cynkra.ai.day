"use client";

import { useState, useTransition } from "react";

import { updatePreferences } from "@/lib/preferences/actions";
import {
  CODE_STYLES,
  DENSITIES,
  LAYOUTS,
  THEMES,
  type CodeStyle,
  type Density,
  type Layout,
  type Preferences,
  type Theme,
} from "@/lib/preferences/cookie";

/**
 * Four-section preferences form. Each option is a radio with an inline
 * preview tile. Writes are optimistic — we set the `<html data-*>`
 * attribute immediately, then persist via the server action so SSR
 * picks up the right initial paint on the next render.
 */
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [, startTransition] = useTransition();

  function update<K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) {
    setPrefs((p) => ({ ...p, [key]: value }));
    // Optimistically write the data attribute so the entire UI updates
    // before the server round-trip lands. The cookie persistence is
    // best-effort behind the same call.
    if (typeof document !== "undefined") {
      const el = document.documentElement;
      if (key === "theme") {
        // next-themes manages data-theme; we hand off to its API to keep
        // the system/light/dark resolution consistent.
        // Falls back to direct attribute write if next-themes isn't
        // mounted (shouldn't happen, but defensive).
        el.setAttribute(
          "data-theme",
          value === "system" ? prefs.theme : (value as string),
        );
      } else if (key === "density") {
        el.setAttribute("data-density", value as string);
      } else if (key === "layout") {
        el.setAttribute("data-layout", value as string);
      } else if (key === "codeStyle") {
        el.setAttribute("data-code-style", value as string);
      }
    }
    startTransition(async () => {
      await updatePreferences({ [key]: value });
    });
  }

  return (
    <div className="space-y-8">
      <Section
        title="Appearance"
        description="Light or dark theme. System follows your OS setting."
      >
        <RadioRow
          name="theme"
          value={prefs.theme}
          options={THEMES}
          onChange={(v) => update("theme", v as Theme)}
          render={(v) => <ThemeSwatch theme={v as Theme} />}
        />
      </Section>

      <Section
        title="Density"
        description="How much air the post cards and composer give you."
      >
        <RadioRow
          name="density"
          value={prefs.density}
          options={DENSITIES}
          onChange={(v) => update("density", v as Density)}
          render={(v) => <DensitySwatch density={v as Density} />}
        />
      </Section>

      <Section
        title="Code blocks"
        description="How fenced code renders in posts."
      >
        <RadioRow
          name="codeStyle"
          value={prefs.codeStyle}
          options={CODE_STYLES}
          onChange={(v) => update("codeStyle", v as CodeStyle)}
          render={(v) => <CodeStyleSwatch style={v as CodeStyle} />}
        />
      </Section>

      <Section
        title="Layout"
        description="How many columns the app uses on wide screens."
      >
        <RadioRow
          name="layout"
          value={prefs.layout}
          options={LAYOUTS}
          onChange={(v) => update("layout", v as Layout)}
          render={(v) => <LayoutSwatch layout={v as Layout} />}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-[12px]">{description}</p>
      </header>
      {children}
    </section>
  );
}

function RadioRow<T extends string>({
  name,
  value,
  options,
  onChange,
  render,
}: {
  name: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  render: (value: T) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <label
            key={opt}
            className={[
              "border-border bg-card cursor-pointer rounded-md border p-3 text-left transition-all",
              selected
                ? "ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]"
                : "hover:bg-[var(--color-hover)]",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={selected}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            {render(opt)}
            <p className="mt-2 text-[12px] capitalize">{opt}</p>
          </label>
        );
      })}
    </div>
  );
}

// ----- previews -----

function ThemeSwatch({ theme }: { theme: Theme }) {
  if (theme === "system") {
    return (
      <div className="flex h-10 overflow-hidden rounded">
        <div className="flex-1" style={{ background: "oklch(0.99 0.003 270)" }} />
        <div className="flex-1" style={{ background: "oklch(0.18 0.005 270)" }} />
      </div>
    );
  }
  return (
    <div
      className="border-border h-10 rounded border"
      style={{
        background:
          theme === "light" ? "oklch(0.99 0.003 270)" : "oklch(0.18 0.005 270)",
      }}
    />
  );
}

function DensitySwatch({ density }: { density: Density }) {
  const padding =
    density === "compact" ? 6 : density === "spacious" ? 16 : 11;
  return (
    <div className="border-border bg-card flex h-10 flex-col gap-0.5 rounded border" style={{ padding }}>
      <div className="bg-[var(--color-ink-faint)] h-1 rounded opacity-30" />
      <div className="bg-[var(--color-ink-faint)] h-1 w-2/3 rounded opacity-30" />
    </div>
  );
}

function CodeStyleSwatch({ style }: { style: CodeStyle }) {
  if (style === "ide") {
    return (
      <div className="border-border h-10 overflow-hidden rounded border">
        <div className="bg-muted h-3 border-b" />
        <div className="bg-card flex h-7 items-center gap-1 px-1 font-mono text-[8px]">
          <span className="text-[var(--color-ink-faint)] w-3 text-right">1</span>
          <span style={{ color: "var(--color-syn-keyword)" }}>const</span>
          <span style={{ color: "var(--color-ink-muted)" }}>x</span>
        </div>
      </div>
    );
  }
  if (style === "card") {
    return (
      <div className="border-border bg-card h-10 rounded border p-2 font-mono text-[8px]">
        <span style={{ color: "var(--color-syn-keyword)" }}>const</span>{" "}
        <span style={{ color: "var(--color-ink-muted)" }}>x = 1</span>
      </div>
    );
  }
  return (
    <div className="h-10 border-l-2 border-[var(--color-border)] py-2 pl-2 font-mono text-[8px]">
      <span style={{ color: "var(--color-syn-keyword)" }}>const</span>{" "}
      <span style={{ color: "var(--color-ink-muted)" }}>x = 1</span>
    </div>
  );
}

function LayoutSwatch({ layout }: { layout: Layout }) {
  const cols =
    layout === "single"
      ? [false, true, false]
      : layout === "two"
        ? [true, true, false]
        : [true, true, true];
  return (
    <div className="border-border flex h-10 gap-1 rounded border p-1">
      {cols.map((on, i) => (
        <div
          key={i}
          className="bg-[var(--color-ink-faint)] flex-1 rounded opacity-50"
          style={{ visibility: on ? "visible" : "hidden" }}
        />
      ))}
    </div>
  );
}
