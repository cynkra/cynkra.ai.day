import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/site/theme-provider";
import { PREFS_COOKIE, parsePreferences } from "@/lib/preferences/cookie";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

import "./globals.css";

export const metadata: Metadata = {
  title: "DevNest",
  description: "A social network for software developers.",
};

// JetBrains Mono via next/font/google — Next builds & self-hosts at
// build time. Bound to the CSS variable referenced by --font-mono in
// globals.css.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Echo the request id into the DOM so client-rendered error pages can
  // surface it as a support reference even after the server has crashed.
  const requestId = (await headers()).get(REQUEST_ID_HEADER) ?? "";

  // Read user preferences from the cookie so SSR can write the right
  // data-* attributes on <html> on the first paint (no FOUC). The cookie
  // is the single source of truth for theme; <ThemeToggle> writes it
  // via a server action and optimistically flips the data attribute.
  const cookieStore = await cookies();
  const prefs = parsePreferences(cookieStore.get(PREFS_COOKIE)?.value ?? null);
  // For "system", default to "light" on the server (we can't read the
  // user's OS preference here). The inline script below upgrades to
  // "dark" before paint when prefers-color-scheme: dark matches.
  const initialTheme = prefs.theme === "system" ? "light" : prefs.theme;
  const isSystemTheme = prefs.theme === "system";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialTheme}
      data-density={prefs.density}
      data-layout={prefs.layout}
      data-code-style={prefs.codeStyle}
      className={jetbrainsMono.variable}
    >
      <head>
        {requestId ? <meta name="x-request-id" content={requestId} /> : null}
        {isSystemTheme ? (
          // Inline script: when the cookie says "system", read the OS
          // preference synchronously before the body paints. Avoids a
          // light-to-dark flash for users on dark-mode machines.
          // Only this branch ships JS; explicit themes don't need it.
          <script
            dangerouslySetInnerHTML={{
              __html:
                'try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.dataset.theme="dark"}}catch(e){}',
            }}
          />
        ) : null}
      </head>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <ThemeProvider>
          <a
            href="#main-content"
            className="bg-background ring-ring sr-only z-50 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:px-3 focus:py-2 focus:ring-2"
          >
            Skip to main content
          </a>
          <div id="main-content">{children}</div>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
