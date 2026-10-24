import type { MetadataRoute } from 'next';
import { sitioPublico } from '@/lib/url';

// Sólo se indexa la página de inicio. Las apps están detrás del inicio de sesión y las invitaciones llevan
// un token en la dirección; las versiones de prueba de Vercel no se indexan nunca.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === 'preview') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/empresa', '/chofer', '/taller', '/u/', '/imprimir', '/invitacion', '/api/', '/auth/'] },
    sitemap: `${sitioPublico()}/sitemap.xml`,
  };
}
