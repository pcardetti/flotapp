import { QrCode } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { SISTEMAS_FALLA } from '@/lib/taller';
import { FormFalla } from '../formularios';

export const metadata: Metadata = { title: 'Reportar falla' };

export default async function ReportarFalla({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const { organizacion, usuario } = await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  // La unidad del viaje en curso; si no hay viaje, la que vino en la dirección.
  const { data: viaje } = await supabase.from('viajes').select('unidad_id').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'en_curso').maybeSingle();
  const unidadId = viaje?.unidad_id ?? (u && UUID.test(u) ? u : null);
  const { data: unidad } = unidadId
    ? await supabase.from('unidades').select('id, dominio, marca, modelo').eq('id', unidadId).eq('organizacion_id', organizacion.id).maybeSingle()
    : { data: null };

  return (
    <>
      <EncabezadoMovil titulo="Reportar falla" bajada={unidad ? `${unidad.marca} ${unidad.modelo}` : undefined} atras="/chofer" accion={unidad && <Patente dominio={unidad.dominio} />} />
      <Pantalla>
        {unidad ? (
          <FormFalla org={organizacion.id} unidad={unidad.id} sistemas={SISTEMAS_FALLA} />
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 pt-10 text-center">
            <div className="grid size-20 place-items-center rounded-full bg-surface-2 text-ink-2"><QrCode className="size-10" /></div>
            <p className="max-w-sm text-ink-2">Para avisar una falla, escaneá primero el QR de la unidad.</p>
            <Link href="/chofer/escanear" className="tap flex h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">Escanear unidad</Link>
          </div>
        )}
      </Pantalla>
    </>
  );
}
