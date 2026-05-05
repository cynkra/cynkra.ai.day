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
  // data-* attributes on <html> on the first paint (no FOUC). next-themes
  // sets data-theme on the client; we still apply a server-side default
  // here so the cascade has a known starting value.
  const cookieStore = await cookies();
  const prefs = parsePreferences(cookieStore.get(PREFS_COOKIE)?.value ?? null);
  const initialTheme = prefs.theme === "system" ? "light" : prefs.theme;

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
