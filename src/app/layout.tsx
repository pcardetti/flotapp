import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { connection } from 'next/server';
import { Avisos } from '@/components/avisos';
import { DESCRIPCION, TITULO } from '@/lib/sitio';
import { sitioPublico } from '@/lib/url';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-barlow' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-condensed' });

// Lo que muestran buscadores y redes. La imagen para compartir es opengraph-image.tsx; las apps internas
// agregan noindex en sus propios diseños.
export const metadata: Metadata = {
  metadataBase: new URL(sitioPublico()),
  title: { default: TITULO, template: '%s · Flotapp' },
  description: DESCRIPCION,
  applicationName: 'Flotapp',
  openGraph: { type: 'website', locale: 'es_AR', siteName: 'Flotapp', title: TITULO, description: DESCRIPCION },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION },
};

export const viewport: Viewport = { themeColor: '#f2f4f7' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // La política de contenido usa un nonce distinto en cada pedido: ninguna página se sirve prearmada,
  // porque sus scripts no tendrían el nonce y el navegador los bloquearía.
  await connection();
  return (
    // suppressHydrationWarning: algunas extensiones del navegador (por ejemplo, modos oscuros) modifican <html> antes de que cargue la app.
    <html lang="es-AR" className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans text-[15px] leading-normal antialiased">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
