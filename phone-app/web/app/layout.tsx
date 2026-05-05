import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from './_components/ServiceWorkerRegistrar';
import { OfflineBanner } from './_components/OfflineBanner';
import { InstallPrompt } from './_components/InstallPrompt';

export const metadata: Metadata = {
  title: 'Phone App',
  description: 'Anki-style flashcards: capture text, review on phone or web.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'PhoneApp',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#171717',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        <OfflineBanner />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
