import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { empresaActual, esGestor, UUID } from '@/lib/empresa';
import { codigoLegible, enlaceUnidad, qrSvg } from '@/lib/qr';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { BotonImprimir } from './imprimir';

export const metadata: Metadata = { title: 'Etiquetas QR' };

// Hoja de etiquetas para pegar en la cabina de cada unidad (A4, 6 por hoja).
export default async function EtiquetasQr({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ u?: string }> }) {
  const { org } = await params;
  const { u } = await searchParams;
  const { organizacion, rol } = await empresaActual(org);
  if (!esGestor(rol) && rol !== 'lectura') notFound();
  const supabase = await crearClienteServidor();
  let consulta = supabase.from('unidades').select('id, dominio, marca, modelo, qr_token').eq('organizacion_id', org).neq('estado', 'baja').order('dominio');
  if (u && UUID.test(u)) consulta = consulta.eq('id', u);
  const { data: unidades, error } = await consulta;
  avisarError('etiquetas', error);
  const etiquetas = await Promise.all(
    (unidades ?? []).map(async (x) => ({ ...x, svg: await qrSvg(await enlaceUnidad(x.qr_token)) })),
  );

  return (
    <main className="mx-auto flex w-full max-w-[210mm] flex-col gap-6 bg-white p-6 text-black print:p-0">
      <Link href={u && UUID.test(u) ? `/empresa/${org}/flota/unidades/${u}` : `/empresa/${org}/flota`} className="no-imprimir text-sm font-semibold text-accent hover:underline">
        ← Volver
      </Link>
      <div className="no-imprimir -mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-ink">
        <p className="text-sm">
          {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'} de {organizacion.nombre}. Imprimilas desde la versión publicada para que el QR apunte a internet,
          y pegalas en la cabina, a la vista del chofer.
        </p>
        <BotonImprimir />
      </div>
      {error && <p className="no-imprimir text-crit">No pudimos cargar las unidades. Si todavía no ejecutaste la migración 0002 en Supabase, hacelo y recargá.</p>}
      <div className="grid grid-cols-2 gap-[6mm]">
        {etiquetas.map((e) => (
          <section key={e.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-[4mm] border-2 border-black p-[5mm] text-center">
            <p className="font-display text-[22pt] font-bold leading-none tracking-[0.08em]">{e.dominio}</p>
            <p className="text-[9pt] text-neutral-600">{e.marca} {e.modelo}</p>
            <div className="my-1 w-[48mm] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: e.svg }} />
            <p className="font-display text-[16pt] font-bold tracking-[0.2em]">{codigoLegible(e.qr_token)}</p>
            <p className="text-[8.5pt] leading-tight">Escaneá con la cámara para el chequeo y el viaje.<br />{organizacion.nombre} · Flotapp</p>
          </section>
        ))}
      </div>
    </main>
  );
}
