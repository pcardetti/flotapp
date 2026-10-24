import { NextResponse, type NextRequest } from 'next/server';
import { misEmpresas, UUID } from '@/lib/empresa';
import { mercadoPagoConfigurado, revisarAlVolver } from '@/lib/pagos/mercadopago';
import { puede } from '@/lib/permisos';

// Adonde vuelve la persona después de autorizar el pago en Mercado Pago: se consulta la suscripción y, si ya quedó
// autorizada, se activa sin esperar el aviso. Después sigue a la pantalla Suscripción, que dice cómo quedó.
export const dynamic = 'force-dynamic';

export async function GET(pedido: NextRequest, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const url = pedido.nextUrl;
  if (!UUID.test(org)) return NextResponse.redirect(new URL('/empresas', url.origin));
  const id = url.searchParams.get('id') ?? url.searchParams.get('preapproval_id');
  const miembro = (await misEmpresas()).find((m) => m.organizacion.id === org);
  let aviso = 'pago';
  if (id && /^[\w-]{6,64}$/.test(id) && miembro && puede(miembro, 'suscripcion.administrar') && mercadoPagoConfigurado()) {
    try {
      if (await revisarAlVolver(org, id)) aviso = 'plan-activo';
    } catch (e) {
      console.error('[mercadopago] vuelta del pago', e);
    }
  }
  return NextResponse.redirect(new URL(`/empresa/${org}/suscripcion?ok=${aviso}`, url.origin));
}
