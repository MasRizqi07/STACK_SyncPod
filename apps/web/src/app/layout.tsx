import type { Metadata } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { COPY } from '@/copy';
import { getRealtimeMode } from '@/features/realtime/config';

export const metadata: Metadata = {
  title: COPY.brand.name,
  description: COPY.brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isFakeMode = getRealtimeMode() === 'fake';

  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-canvas text-ink-primary antialiased">
        {children}
        {isFakeMode && (
          <aside
            aria-label="Status prototipe"
            className="pointer-events-none fixed bottom-2 right-2 z-50 rounded bg-surface/80 px-2 py-0.5 text-[11px] font-mono text-ink-muted border border-border-subtle"
          >
            {COPY.auth.prototypeNotice}
          </aside>
        )}
      </body>
    </html>
  );
}

