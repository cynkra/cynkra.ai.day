# Sign-in — visual spec

Behavior is fully specified by `bootstrap-devnest-mvp/specs/auth/`.
This file specifies *visual* requirements only.

## Layout

- Full-viewport centered card. Max width 480px. Vertical: card
  centered with 64px breathing room above and below on tall
  viewports.
- Card: `--bg-elev`, `--border`, `--radius`, `--shadow-md`,
  padding 40 horizontal / 48 vertical.
- Outside the card, bottom-center: a mono 11 row with three
  faint links — "terms · privacy · status".

## Header

- Brand mark: `{` `}` braces in `--accent` flanking the wordmark
  "devnest", where `nest` carries a non-blinking caret-style
  underline (1.5px, `--accent`).
- Headline below: 20 sans, weight 600, "Sign in to DevNest".
- Subheadline: 13 `--ink-muted`, "for software developers."

## Provider buttons

In this exact order:

1. **GitHub** — black-on-white in light theme, white-on-black in
   dark, mono GitHub mark on the left, "Continue with GitHub" 14
   sans on the right. Full-width, 40 tall.
2. **GitLab** — `--bg-sunken` fill, `--border-strong` 1px,
   GitLab mark in tango orange (the brand color, kept), label in
   `--ink`.
3. **Email** — outline variant. Clicking expands in place.

Between the buttons: 10px gap. Between (2) and (3): a thin
horizontal divider with the word "or" (mono 10
`--ink-faint`) at the center, total height 32px.

## Email expanded state

- Email input slides into the slot of the email button.
- Below it: a primary `[Send magic link]` button.
- Below that: a ghost `[Use a different method]` link, mono 11.

## Check-your-email state

Replaces the entire form region (header stays).

- Centered: a mono mailbox glyph (lucide `Mail`, 24px,
  `--accent`).
- 16 sans line: "We sent a magic link to {email}."
- 13 `--ink-muted` line: "Click the link to finish signing in."
- Ghost button: "Wrong email? Try again."

## OAuth conflict screen

Reached when an unverified-email OAuth identity collides with an
existing account.

- Two avatars side-by-side at the top, gap 16, with a 1-char
  mono `↔` between.
- Below: 14 sans, "An account already exists for {email}."
- Below: 13 `--ink-muted`, "Sign in with the existing method,
  then link {provider} from /me/settings."
- Two outline buttons: `[Sign in with {existing method}]` /
  `[Cancel]`.
