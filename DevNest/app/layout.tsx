import type { Metadata } from "next";
import { headers } from "next/headers";
import { Toaster } from "sonner";

import { SiteHeader } from "@/components/site/site-header";
import { ThemeProvider } from "@/components/site/theme-provider";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

import "./globals.css";

export const metadata: Metadata = {
  title: "DevNest",
  description: "A social network for software developers.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Echo the request id into the DOM so client-rendered error pages can
  // surface it as a support reference even after the server has crashed.
  const requestId = (await headers()).get(REQUEST_ID_HEADER) ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {requestId ? <meta name="x-request-id" content={requestId} /> : null}
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <a
            href="#main-content"
            className="bg-background ring-ring sr-only z-50 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:px-3 focus:py-2 focus:ring-2"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <div id="main-content">{children}</div>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
