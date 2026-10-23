import { Route } from 'lucide-react';
import type { Metadata } from 'next';
import { EncabezadoMovil, Fila, Seccion, Vacio } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente, Pildora } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { cuando, duracion } from '@/lib/fechas';
import { km } from '@/lib/formato';
import { crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mis viajes' };

export default async function MisViajes() {
  const { organizacion, usuario } = await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  const { data: viajes } = await supabase.from('viajes')
    .select('id, estado, inicio, fin, km_inicio, km_fin, destino, unidad:unidades(dominio)')
    .eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).order('inicio', { ascending: false }).limit(50);
  const total = (viajes ?? []).reduce((a, v) => a + ((v.km_fin ?? v.km_inicio) - v.km_inicio), 0);

  return (
    <>
      <EncabezadoMovil titulo="Mis viajes" bajada={viajes?.length ? `${viajes.length} ${viajes.length === 1 ? 'viaje' : 'viajes'} · ${km(total)}` : undefined} />
      <Pantalla>
        <Seccion>
          {viajes?.length ? (
            viajes.map((v) => {
              const unidad = (Array.isArray(v.unidad) ? v.unidad[0] : v.unidad) as { dominio: string } | null;
              return (
                <Fila key={v.id}>
                  <Patente dominio={unidad?.dominio ?? '—'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.destino ?? (v.estado === 'en_curso' ? 'Viaje en curso' : 'Viaje')}</p>
                    <p className="text-sm text-ink-3">{cuando(v.inicio)} · {v.fin ? duracion(v.inicio, v.fin) : duracion(v.inicio)}</p>
                  </div>
                  {v.estado === 'en_curso' ? <Pildora tipo="info">En curso</Pildora> : <b className="whitespace-nowrap">{km((v.km_fin ?? v.km_inicio) - v.km_inicio)}</b>}
                </Fila>
              );
            })
          ) : (
            <Vacio icono={<Route className="size-6" />} titulo="Todavía no hiciste viajes">Cuando escanees una unidad y completes el chequeo, tus viajes van a aparecer acá.</Vacio>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
