import { headers } from 'next/headers';

const imprimible = (texto: string, largo: number) => texto.replace(/[^\x20-\x7e]/g, '').slice(0, largo);

// IP de quien usa la app: en Vercel, la primera de x-forwarded-for la pone Vercel y no se puede falsear.
export async function ipCliente() {
  const h = await headers();
  return imprimible(h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida', 64);
}

export async function agenteCliente() {
  return imprimible((await headers()).get('user-agent') ?? '', 300);
}
