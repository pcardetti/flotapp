import { History } from 'lucide-react';
import type { Metadata } from 'next';
import { EncabezadoMovil, Fila, Seccion, Vacio } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { Patente, Pildora } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { fechaCorta } from '@/lib/fechas';
import { pesos } from '@/lib/formato';
import { crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Historial' };

export default async function Historial() {
  const { organizacion } = await contextoApp('taller');
  const supabase = await crearClienteServidor();
  const { data: ordenes } = await supabase.from('ordenes')
    .select('id, numero, tipo, descripcion, fecha_egreso, repuestos, mano_obra, unidad:unidades(id, dominio)')
    .eq('organizacion_id', organizacion.id).eq('estado', 'cerrada').order('fecha_egreso', { ascending: false }).order('numero', { ascending: false }).limit(60);
  return (
    <>
      <EncabezadoMovil titulo="Historial" bajada="Trabajos terminados" />
      <Pantalla>
        <Seccion>
          {ordenes?.length ? (
            ordenes.map((o) => {
              const u = (Array.isArray(o.unidad) ? o.unidad[0] : o.unidad) as { id: string; dominio: string } | null;
              const costo = Number(o.repuestos) + Number(o.mano_obra);
              return (
                <Adelante key={o.id} href={u ? `/taller/unidad/${u.id}` : '/taller'} className="tap">
                  <Fila>
                    <Patente dominio={u?.dominio ?? '—'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{o.descripcion}</p>
                      <p className="text-sm text-ink-3">#{o.numero} · {o.fecha_egreso ? fechaCorta(`${o.fecha_egreso}T12:00`) : ''}{costo ? ` · ${pesos(costo)}` : ''}</p>
                    </div>
                    <Pildora tipo={o.tipo === 'preventivo' ? 'info' : 'neutro'}>{o.tipo === 'preventivo' ? 'Mant.' : 'Rep.'}</Pildora>
                  </Fila>
                </Adelante>
              );
            })
          ) : (
            <Vacio icono={<History className="size-6" />} titulo="Sin trabajos todavía">Cada reparación o mantenimiento que registres queda acá, con fotos y costos.</Vacio>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
