import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { connection } from 'next/server';
import { Avisos } from '@/components/avisos';
import { DESCRIPCION, TITULO } from '@/lib/sitio';
import { sitioPublico } from '@/lib/url';
import './globals.css';

// IBM Plex Sans para todo el texto y IBM Plex Mono para kilómetros, pesos y patentes (cada cifra ocupa lo mismo).
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-plex-mono' });

// Lo que muestran buscadores y redes. La imagen para compartir es opengraph-image.tsx; las apps internas
// agregan noindex en sus propios diseños.
export const metadata: Metadata = {
  metadataBase: new URL(sitioPublico()),
  title: { default: TITULO, template: '%s · Tallerflota' },
  description: DESCRIPCION,
  applicationName: 'Tallerflota',
  openGraph: { type: 'website', locale: 'es_AR', siteName: 'Tallerflota', title: TITULO, description: DESCRIPCION },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION },
};

export const viewport: Viewport = { themeColor: '#f4f5f7' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // La política de contenido usa un nonce distinto en cada pedido: ninguna página se sirve prearmada,
  // porque sus scripts no tendrían el nonce y el navegador los bloquearía.
  await connection();
  return (
    // suppressHydrationWarning: algunas extensiones del navegador (por ejemplo, modos oscuros) modifican <html> antes de que cargue la app.
    <html lang="es-AR" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans text-[15px] leading-normal antialiased">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
