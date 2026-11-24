import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'Lex Detetive',
  description: 'Monitoramento jurídico e investigação processual — Lex Tecnologias',
  applicationName: 'Lex Detetive',
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icons/icon-192.png`, apple: `${base}/icons/icon-180.png` },
  appleWebApp: { capable: true, title: 'Lex Detetive', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0B1F3A',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
