import type { Metadata } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { COPY } from '@/copy';

export const metadata: Metadata = {
  title: COPY.brand.name,
  description: COPY.brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-canvas text-ink-primary antialiased">
        {children}
      </body>
    </html>
  );
}

