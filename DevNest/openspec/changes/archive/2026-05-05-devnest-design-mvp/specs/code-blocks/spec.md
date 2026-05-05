# Code blocks — visual spec

The most distinctive component in DevNest. Three styles, all
tokenized; user preference `code.style` (set in `/me/settings`)
selects one via `data-code-style` on `<html>`.

## Common

- Source-of-truth for highlighting is the existing
  `lib/markdown` Shiki pipeline (`bootstrap-devnest-mvp`).
- Shiki theme tokens are remapped to `--color-syn-*`, so a
  single render covers light + dark themes (no re-shiki on
  theme change).
- Copy button copies the **raw** source, not the highlighted
  HTML. Confirmation: icon swaps from `Copy` to `Check` for
  1.2s and announces via `aria-live="polite"`.
- Long lines use `overflow-x: auto`. Soft wrap is a future
  preference.

## Style: `ide` (default)

- Outer: `--bg` background, `--border` 1px hairline,
  `--radius`, no shadow.
- Header bar 28px tall, `--bg-sunken` fill, with:
  - Filename slot (left, mono 11 `--ink-muted`, optional `●`
    prefix when modified).
  - Language pill (mono 10 uppercase, `--ink-faint`,
    letter-spacing 0.06em).
  - Copy button (right, ghost variant, mono 10).
- Body: monospace 12, line-height 1.65, padding 10
  vertical / 12 horizontal.
- Gutter: 32px, mono 11, `--ink-faint`, right-aligned,
  `border-right: 1px var(--border)`.

## Style: `card`

- No header bar, no gutter.
- Outer: `--bg-elev` background, `--border` 1px,
  `--radius`, padding 12.
- Copy button is a floating ghost-icon in the top-right,
  visible only on card hover.
- Language pill is omitted from the body; it appears only as a
  hover tooltip on the card.

## Style: `subtle`

- No background, no border.
- Left rule: 2px `--border` solid, with 12px content offset.
- Padding 6 vertical / 0 horizontal.
- No copy button (subtle is for snippets <4 lines).
- Reserved for inline use; the composer never produces this
  style — only in rendered conversation threads where the
  block is contextually small.

## Density interaction

Code blocks are not affected by the `data-density` knob —
their padding stays constant so column widths don't reflow on
density change. Posts around them grow / shrink instead.

## Print

When the user prints (or save-as-PDF), all code blocks render
as `style: ide` regardless of preference, with line numbers on,
to maximize archive legibility.
