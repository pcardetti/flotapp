import type { NextConfig } from 'next';
import { avisosDeEntorno, problemasDeEntorno } from './src/lib/entorno';

// Al compilar para producción, una configuración incompleta corta la compilación; en la PC sólo avisa
// (la app muestra qué falta). El modo demo no usa Supabase.
if (process.env.FLOTAPP_DEMO !== '1') {
  const problemas = problemasDeEntorno(process.env);
  if (problemas.length) {
    const texto = `Configuración de Flotapp incompleta:\n- ${problemas.join('\n- ')}`;
    if (process.env.NODE_ENV === 'production') throw new Error(texto);
    console.warn(texto);
  }
  const avisos = avisosDeEntorno(process.env);
  if (avisos.length && process.env.NODE_ENV === 'production') console.warn(`Recomendado para Flotapp:\n- ${avisos.join('\n- ')}`);
}

// Cabeceras fijas de seguridad. La política de contenido (CSP) lleva un nonce por pedido y la arma el proxy.
const SEGURIDAD = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La cámara se usa para el QR y las fotos; nada más del dispositivo.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// Lo que está detrás del inicio de sesión, las invitaciones y la API no se indexa.
const NO_INDEXAR = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };
const PRIVADAS = [
  '/empresa/:path*', '/empresas', '/chofer/:path*', '/taller/:path*', '/u/:path*', '/imprimir/:path*',
  '/api/:path*', '/auth/:path*', '/ingresar', '/registrarse',
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SEGURIDAD },
      ...PRIVADAS.map((source) => ({ source, headers: [NO_INDEXAR] })),
      // El enlace de invitación lleva un token: no se manda como "referer" a ningún otro sitio.
      { source: '/invitacion/:path*', headers: [NO_INDEXAR, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;
