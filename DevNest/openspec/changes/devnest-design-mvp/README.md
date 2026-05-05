# DevNest — Design MVP

> **Where to drop these files:**
> Copy this folder into `DevNest/openspec/changes/devnest-design-mvp/`
> on the `devnest-main` branch, then commit:
>
> ```
> git checkout devnest-main
> mkdir -p DevNest/openspec/changes/devnest-design-mvp
> cp -r handoff/openspec/changes/devnest-design-mvp/. \
>       DevNest/openspec/changes/devnest-design-mvp/
> git add DevNest/openspec/changes/devnest-design-mvp
> git commit -m "design: initial visual + UX proposal for DevNest MVP"
> ```
>
> The interactive HTML prototype these specs describe lives outside the
> repo at `DevNest Prototype.html` (one level up from `handoff/`).
> Open it in a browser and use the Tweaks panel to flip theme, density,
> code-block style, and column layout — every value documented here is
> wired to a knob there.

## Files in this change

| File | What it is |
|---|---|
| `proposal.md` | Why this design exists, what it covers, what it doesn't |
| `design.md` | Visual system (tokens, typography, components, motion) and screen-by-screen anatomy |
| `tasks.md` | Implementation checklist mapping the design onto the existing Next.js / shadcn stack |
| `specs/sign-in/spec.md` | Sign-in screen behavior |
| `specs/feed/spec.md` | Home feed + composer behavior |
| `specs/profile/spec.md` | Developer profile behavior |
| `specs/code-blocks/spec.md` | Code-block rendering rules |
| `tokens.md` | Design tokens (colors, spacing, type) ready to paste into Tailwind v4 `@theme` |
