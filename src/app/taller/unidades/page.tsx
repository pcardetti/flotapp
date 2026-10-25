import { ChevronRight, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import { EncabezadoMovil, Fila, Seccion, Vacio } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { Patente, Pildora } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Unidades' };

export default async function UnidadesTaller() {
  const { organizacion } = await contextoApp('taller');
  const supabase = await crearClienteServidor();
  const [{ data: unidades }, { data: fallas }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, marca, modelo, km, estado').eq('organizacion_id', organizacion.id).neq('estado', 'baja').order('dominio'),
    supabase.from('fallas').select('unidad_id, gravedad').eq('organizacion_id', organizacion.id).in('estado', ['abierta', 'en_reparacion']),
  ]);
  const pendientes = new Map<string, { total: number; criticas: number }>();
  for (const f of fallas ?? []) {
    const p = pendientes.get(f.unidad_id) ?? { total: 0, criticas: 0 };
    p.total++;
    if (f.gravedad === 'critica') p.criticas++;
    pendientes.set(f.unidad_id, p);
  }
  return (
    <>
      <EncabezadoMovil titulo="Unidades" bajada={`${unidades?.length ?? 0} en la flota`} />
      <Pantalla>
        <Seccion>
          {unidades?.length ? (
            unidades.map((u) => {
              const p = pendientes.get(u.id);
              return (
                <Adelante key={u.id} href={`/taller/unidad/${u.id}`} className="tap">
                  <Fila>
                    <Patente dominio={u.dominio} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.marca} {u.modelo}</p>
                      <p className="text-sm text-ink-3">{u.km != null ? `${u.km.toLocaleString('es-AR')} km` : 'Sin odómetro'}</p>
                    </div>
                    {p ? <Pildora tipo={p.criticas ? 'crit' : 'warn'}>{p.total} {p.total === 1 ? 'falla' : 'fallas'}</Pildora> : u.estado === 'taller' ? <Pildora tipo="warn">Parada</Pildora> : null}
                    <ChevronRight className="size-5 text-ink-3" />
                  </Fila>
                </Adelante>
              );
            })
          ) : (
            <Vacio icono={<Truck className="size-6" />} titulo="No hay unidades cargadas">El administrador de la flota las carga desde Tallerflota.</Vacio>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
