import { CheckCircle2, ChevronRight, ClipboardList, QrCode } from 'lucide-react';
import type { Metadata } from 'next';
import { AvisoCuenta } from '@/components/aviso-cuenta';
import { TarjetaFalla, type FallaVista } from '@/components/falla';
import { EncabezadoMovil, Fila, Seccion, Vacio } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { Patente, Pildora } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { fechaCorta } from '@/lib/fechas';
import { firmarFotos } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

// La plantilla de título del layout no alcanza a su propia página de inicio: va el nombre completo.
export const metadata: Metadata = { title: { absolute: 'Flotapp Taller' } };

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;
type UnidadMin = { id: string; dominio: string; marca: string; modelo: string; estado: string };

export default async function Pendientes() {
  const { organizacion } = await contextoApp('taller');
  const supabase = await crearClienteServidor();
  const [{ data: fallas, error: e1 }, { data: ordenes, error: e2 }] = await Promise.all([
    supabase.from('fallas')
      .select('id, sistema, descripcion, gravedad, estado, fotos, creada_en, orden_id, unidad:unidades(id, dominio, marca, modelo, estado), chofer:choferes(nombre)')
      .eq('organizacion_id', organizacion.id).in('estado', ['abierta', 'en_reparacion']).order('creada_en', { ascending: false }),
    supabase.from('ordenes').select('id, numero, descripcion, fecha_ingreso, deja_fuera_servicio, unidad:unidades(id, dominio)')
      .eq('organizacion_id', organizacion.id).neq('estado', 'cerrada').order('fecha_ingreso'),
  ]);
  avisarError('taller/fallas', e1);
  avisarError('taller/ordenes', e2);

  // Agrupadas por unidad; primero las unidades con fallas críticas.
  const grupos = new Map<string, { unidad: UnidadMin; fallas: FallaVista[]; critica: boolean }>();
  for (const f of fallas ?? []) {
    const u = uno(f.unidad as Uno<UnidadMin>);
    if (!u) continue;
    const g = grupos.get(u.id) ?? { unidad: u, fallas: [], critica: false };
    g.fallas.push({ ...f, chofer: uno(f.chofer as Uno<{ nombre: string }>)?.nombre ?? null } as FallaVista);
    g.critica ||= f.gravedad === 'critica';
    grupos.set(u.id, g);
  }
  const lista = [...grupos.values()].sort((a, b) => Number(b.critica) - Number(a.critica) || b.fallas.length - a.fallas.length);
  const urls = await firmarFotos((fallas ?? []).flatMap((f) => (f.fotos as string[]).slice(0, 4)));

  return (
    <>
      <EncabezadoMovil
        titulo="Pendientes"
        bajada={organizacion.nombre}
        accion={<Adelante href="/taller/escanear" aria-label="Escanear unidad" className="tap grid size-11 place-items-center rounded-full bg-accent text-accent-ink"><QrCode className="size-6" /></Adelante>}
      />
      <AvisoCuenta org={organizacion.id} admin={false} movil />
      <Pantalla>
        {!lista.length && !ordenes?.length && (
          <Seccion>
            <Vacio icono={<CheckCircle2 className="size-6" />} titulo="Todo al día">No hay fallas reportadas ni órdenes abiertas. Para registrar un mantenimiento, escaneá la unidad.</Vacio>
            <Adelante href="/taller/escanear" className="tap flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-accent-ink shadow-tarjeta">
              <QrCode className="size-5" />Escanear unidad
            </Adelante>
          </Seccion>
        )}

        {lista.map((g) => (
          <Seccion key={g.unidad.id}>
            <Adelante href={`/taller/unidad/${g.unidad.id}`} className="tap flex items-center gap-3 px-1">
              <Patente dominio={g.unidad.dominio} />
              <span className="min-w-0 flex-1 truncate font-semibold">{g.unidad.marca} {g.unidad.modelo}</span>
              {g.unidad.estado === 'taller' && <Pildora tipo="warn">Parada</Pildora>}
              <ChevronRight className="size-5 text-ink-3" />
            </Adelante>
            {g.fallas.map((f) => (
              <TarjetaFalla key={f.id} falla={f} urls={urls}>
                {f.estado === 'abierta' && (
                  <Adelante href={`/taller/unidad/${g.unidad.id}/trabajo?falla=${f.id}`} className="tap mt-1 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-ink">
                    Resolver
                  </Adelante>
                )}
                {f.estado === 'en_reparacion' && f.orden_id && (
                  <Adelante href={`/taller/orden/${f.orden_id}`} className="tap mt-1 flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold">
                    Ver la orden
                  </Adelante>
                )}
              </TarjetaFalla>
            ))}
          </Seccion>
        ))}

        {ordenes && ordenes.length > 0 && (
          <Seccion titulo="Órdenes abiertas">
            {ordenes.map((o) => {
              const u = uno(o.unidad as Uno<{ id: string; dominio: string }>);
              return (
                <Adelante key={o.id} href={`/taller/orden/${o.id}`} className="tap">
                  <Fila>
                    <ClipboardList className="size-5 shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">#{o.numero} · {o.descripcion}</p>
                      <p className="text-sm text-ink-3">{u?.dominio} · desde el {fechaCorta(`${o.fecha_ingreso}T12:00`)}</p>
                    </div>
                    {o.deja_fuera_servicio && <Pildora tipo="warn">Parada</Pildora>}
                  </Fila>
                </Adelante>
              );
            })}
          </Seccion>
        )}
      </Pantalla>
    </>
  );
}
