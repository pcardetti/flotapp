import { cerrarEvento, recibirEvento } from '@/lib/pagos/base';
import { firmaValida } from '@/lib/pagos/firma';
import { mercadoPagoConfigurado, procesarAviso } from '@/lib/pagos/mercadopago';

// Avisos (webhooks) de Mercado Pago sobre suscripciones y cobros. Cada aviso se verifica con su firma, se anota una
// sola vez (si llega repetido no se vuelve a procesar) y el estado real se consulta en la API de Mercado Pago.
// Respuestas: 200 procesado o repetido; 401 firma inválida; 500/503 para que Mercado Pago lo reintente.
export const dynamic = 'force-dynamic';

export async function POST(pedido: Request) {
  if (!mercadoPagoConfigurado()) return new Response(null, { status: 404 });
  const url = new URL(pedido.url);
  const cuerpo = (await pedido.json().catch(() => null)) as { id?: string | number; type?: string; data?: { id?: string | number } } | null;
  const recurso = url.searchParams.get('data.id') ?? (cuerpo?.data?.id != null ? String(cuerpo.data.id) : null);
  const tipo = cuerpo?.type ?? url.searchParams.get('type') ?? '';
  const idPedido = pedido.headers.get('x-request-id');

  if (!firmaValida(pedido.headers.get('x-signature'), idPedido, recurso, process.env.MP_WEBHOOK_SECRET ?? '')) {
    return new Response(null, { status: 401 });
  }
  if (!recurso || !tipo) return Response.json({ ok: true, ignorado: true });

  const evento = String(cuerpo?.id ?? `${tipo}:${recurso}:${idPedido ?? ''}`);
  const nuevo = await recibirEvento({ proveedor: 'mercadopago', evento, tipo, recurso });
  if (nuevo === null) return new Response(null, { status: 503 });
  if (!nuevo) return Response.json({ ok: true, repetido: true });

  try {
    await procesarAviso(tipo, recurso);
    await cerrarEvento({ proveedor: 'mercadopago', evento });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[mercadopago] aviso', e);
    await cerrarEvento({ proveedor: 'mercadopago', evento, error: e instanceof Error ? e.message : String(e) });
    return new Response(null, { status: 500 });
  }
}
