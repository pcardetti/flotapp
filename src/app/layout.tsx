import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-barlow' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-condensed' });

export const metadata: Metadata = {
  title: { default: 'Flotapp', template: '%s · Flotapp' },
  description: 'Mantenimiento de flotas de camiones: services, órdenes, vencimientos y neumáticos, con talleres y recapadoras conectados.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d131b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-dvh font-sans text-[15px] leading-normal antialiased">{children}</body>
    </html>
  );
}
