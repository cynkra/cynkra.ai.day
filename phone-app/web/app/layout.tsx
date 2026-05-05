import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phone App',
  description: 'Anki-style flashcards: capture, review, AI-generate.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
