import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EncabezadoMovil, Seccion } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { fechaCorta } from '@/lib/fechas';
import { crearClienteServidor } from '@/lib/supabase/server';
import { nombreSistema } from '@/lib/taller';
import { FormCerrarOrden } from '../../formularios';

export const metadata: Metadata = { title: 'Cerrar orden' };

export default async function CerrarOrden({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizacion } = await contextoApp('taller');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const { data: o } = await supabase.from('ordenes')
    .select('id, numero, descripcion, estado, fecha_ingreso, unidad:unidades(id, dominio, km), fallas(sistema, descripcion)')
    .eq('id', id).eq('organizacion_id', organizacion.id).maybeSingle();
  if (!o) notFound();
  const u = (Array.isArray(o.unidad) ? o.unidad[0] : o.unidad) as { id: string; dominio: string; km: number | null } | null;
  if (!u) notFound();
  const fallas = (o.fallas ?? []) as { sistema: string; descripcion: string | null }[];
  return (
    <>
      <EncabezadoMovil titulo={`Orden #${o.numero}`} bajada={`Abierta el ${fechaCorta(`${o.fecha_ingreso}T12:00`)}`} atras={`/taller/unidad/${u.id}`} accion={<Patente dominio={u.dominio} />} />
      <Pantalla>
        <Seccion>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-display text-xl font-bold">{o.descripcion}</p>
            {fallas.length > 0 && <p className="mt-1 text-sm text-ink-3">Resuelve: {fallas.map((f) => nombreSistema(f.sistema)).join(', ')}</p>}
          </div>
        </Seccion>
        {o.estado === 'cerrada' ? (
          <Seccion><p className="text-ink-2">Esta orden ya está cerrada.</p></Seccion>
        ) : (
          <FormCerrarOrden orden={o.id} unidad={u.id} org={organizacion.id} kmUltimo={u.km} />
        )}
      </Pantalla>
    </>
  );
}
