import { headers } from 'next/headers';

// Dirección pública de la app. En Vercel sale del pedido; una NEXT_PUBLIC_SITE_URL de localhost copiada por error se ignora.
export async function urlBase() {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL;
  if (sitio && !(process.env.VERCEL && /localhost|127\.0\.0\.1/.test(sitio))) return sitio.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
}
