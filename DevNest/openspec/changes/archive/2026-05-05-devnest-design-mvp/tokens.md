# Tokens

Paste into `app/globals.css` (Tailwind v4 `@theme`) or extract into
`tokens.css` and import from `globals.css`. The shadcn primitives
already in the codebase pick these up via the existing
`--background` / `--foreground` aliases declared at the bottom.

```css
@theme {
  /* === Color — light (default) === */
  --color-bg:           oklch(0.99 0.003 270);
  --color-bg-elev:      oklch(1.00 0.000 0);
  --color-bg-sunken:    oklch(0.97 0.005 270);

  --color-ink:          oklch(0.22 0.01  270);
  --color-ink-muted:    oklch(0.45 0.01  270);
  --color-ink-faint:    oklch(0.62 0.01  270);

  --color-border:       oklch(0.92 0.005 270);
  --color-border-strong:oklch(0.85 0.008 270);
  --color-hover:        oklch(0.95 0.005 270);

  --color-accent:       oklch(0.62 0.16  35);   /* warm amber */
  --color-accent-bg:    oklch(0.96 0.04  35);
  --color-accent-ink:   oklch(0.45 0.18  35);

  --color-ok:           oklch(0.65 0.16 145);
  --color-warn:         oklch(0.72 0.16  85);
  --color-danger:       oklch(0.58 0.20  25);

  /* === Syntax tokens (used by Shiki theme override) === */
  --color-syn-keyword:  oklch(0.50 0.20 305);
  --color-syn-string:   oklch(0.45 0.16 145);
  --color-syn-num:      oklch(0.55 0.16  60);
  --color-syn-fn:       oklch(0.50 0.16 240);
  --color-syn-comment:  oklch(0.62 0.01 270);

  /* === Type === */
  --font-sans: ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* === Radius === */
  --radius-sm: 4px;
  --radius:    8px;
  --radius-lg: 12px;

  /* === Shadow === */
  --shadow-sm: 0 1px 2px oklch(0.18 0.005 270 / 0.06);
  --shadow-md: 0 4px 16px oklch(0.18 0.005 270 / 0.10);

  /* === Layout (overridden per data-layout) === */
  --col-nav: 240px;
  --col-side: 320px;
}

/* === Dark theme === */
[data-theme="dark"] {
  --color-bg:           oklch(0.18 0.005 270);
  --color-bg-elev:      oklch(0.22 0.005 270);
  --color-bg-sunken:    oklch(0.16 0.008 270);

  --color-ink:          oklch(0.94 0.005 270);
  --color-ink-muted:    oklch(0.72 0.008 270);
  --color-ink-faint:    oklch(0.55 0.008 270);

  --color-border:       oklch(0.28 0.008 270);
  --color-border-strong:oklch(0.36 0.010 270);
  --color-hover:        oklch(0.24 0.008 270);

  --color-accent:       oklch(0.72 0.16 35);
  --color-accent-bg:    oklch(0.30 0.06 35);
  --color-accent-ink:   oklch(0.85 0.14 35);

  --color-syn-keyword:  oklch(0.78 0.16 305);
  --color-syn-string:   oklch(0.78 0.14 145);
  --color-syn-num:      oklch(0.80 0.14  60);
  --color-syn-fn:       oklch(0.80 0.14 240);
  --color-syn-comment:  oklch(0.55 0.01 270);
}

/* === Density (modifies internal paddings on cards / composer) === */
[data-density="compact"]    { --pad-card: 12px; --row-h: 28px; }
[data-density="comfortable"]{ --pad-card: 16px; --row-h: 32px; }
[data-density="spacious"]   { --pad-card: 20px; --row-h: 36px; }

/* === Layout === */
[data-layout="single"] { --col-nav: 0;     --col-side: 0; }
[data-layout="two"]    { --col-nav: 240px; --col-side: 0; }
[data-layout="three"]  { --col-nav: 240px; --col-side: 320px; }
[data-layout="wide"]   { --col-nav: 280px; --col-side: 360px; }

/* === shadcn aliases (so existing primitives just work) === */
:root {
  --background: var(--color-bg);
  --foreground: var(--color-ink);
  --card:       var(--color-bg-elev);
  --card-foreground: var(--color-ink);
  --muted:      var(--color-bg-sunken);
  --muted-foreground: var(--color-ink-muted);
  --border:     var(--color-border);
  --input:      var(--color-border);
  --ring:       var(--color-accent);
  --primary:    var(--color-accent);
  --primary-foreground: oklch(1 0 0);
  --destructive: var(--color-danger);
  --radius:     var(--radius);
}
```

## Type scale (Tailwind classes)

| Class | px | line-height | use |
|---|---|---|---|
| `text-[11px]` mono | 11 | 1.4 | kbd hints, gutter, status bar |
| `text-xs` (12) | 12 | 1.5 | metadata, panel titles |
| `text-[13px]` | 13 | 1.55 | body, post copy default |
| `text-sm` (14) | 14 | 1.5 | nav, button labels, card headings |
| `text-base` (16) | 16 | 1.5 | page titles |
| `text-xl` (20) | 20 | 1.4 | empty-state titles |
| `text-3xl` (28) | 28 | 1.2 | brand mark, sign-in hero |

Do not introduce sizes outside this scale without amending this file.

## Spacing scale

`gap-1` (4) · `gap-1.5` (6) · `gap-2` (8) · `gap-2.5` (10) ·
`gap-3` (12) · `gap-3.5` (14) · `gap-4` (16) · `gap-5` (20) ·
`gap-6` (24) · `gap-8` (32) · `gap-10` (40).

48 / 64 are sign-in only.
