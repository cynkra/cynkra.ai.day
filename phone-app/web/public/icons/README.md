# PWA icons

Drop the following PNGs here so the manifest can serve them:

- `icon-192.png` — 192x192, regular icon (`purpose: any`)
- `icon-512.png` — 512x512, regular icon (`purpose: any`)
- `icon-maskable-512.png` — 512x512, maskable icon with safe zone padding
- `apple-touch-icon-180.png` — 180x180, served from `/apple-touch-icon.png` (set up in `app/layout.tsx`)

Until real icons land, iOS Safari falls back to a screenshot of the page on Add-to-Home-Screen and Chrome shows a generic icon. The PWA still installs and works.
