import { CheckCircle2, ClipboardList, Plus, ShieldCheck, ShieldX, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Toast } from '@/components/controles';
import { TarjetaFalla, type FallaVista } from '@/components/falla';
import { EncabezadoMovil, Fila, Seccion } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { Patente, Pildora } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { cuando, fechaCorta } from '@/lib/fechas';
import { firmarFotos } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { descartarFalla } from '../../acciones';

export const metadata: Metadata = { title: 'Unidad' };

const AVISOS: Record<string, string> = { trabajo: 'Trabajo guardado', orden: 'Orden abierta', cerrada: 'Orden cerrada', descartada: 'Falla descartada' };
type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

export default async function UnidadTaller({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { organizacion } = await contextoApp('taller');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const [{ data: u }, { data: fallas, error: e1 }, { data: abiertas }, { data: trabajos }, { data: chequeo }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, marca, modelo, km, estado').eq('id', id).eq('organizacion_id', organizacion.id).maybeSingle(),
    supabase.from('fallas').select('id, sistema, descripcion, gravedad, estado, fotos, creada_en, chofer:choferes(nombre)').eq('unidad_id', id).in('estado', ['abierta', 'en_reparacion']).order('creada_en', { ascending: false }),
    supabase.from('ordenes').select('id, numero, descripcion, fecha_ingreso').eq('unidad_id', id).neq('estado', 'cerrada').order('fecha_ingreso'),
    supabase.from('ordenes').select('id, numero, tipo, descripcion, fecha_egreso, repuestos, mano_obra').eq('unidad_id', id).eq('estado', 'cerrada').order('fecha_egreso', { ascending: false }).limit(5),
    supabase.from('chequeos').select('fecha, aprobado, km, combustible, chofer:choferes(nombre)').eq('unidad_id', id).order('fecha', { ascending: false }).limit(1).maybeSingle(),
  ]);
  avisarError('taller/unidad', e1);
  if (!u) notFound();
  const lista = (fallas ?? []).map((f) => ({ ...f, chofer: uno(f.chofer as Uno<{ nombre: string }>)?.nombre ?? null }) as FallaVista);
  const urls = await firmarFotos(lista.flatMap((f) => f.fotos));
  const quienChequeo = uno(chequeo?.chofer as Uno<{ nombre: string }>)?.nombre;

  return (
    <>
      <Toast mensaje={ok ? AVISOS[ok] : null} />
      <EncabezadoMovil titulo={`${u.marca} ${u.modelo}`} bajada={u.km != null ? `${u.km.toLocaleString('es-AR')} km` : undefined} atras="/taller" accion={<Patente dominio={u.dominio} />} />
      <Pantalla>
        <Seccion>
          <div className="grid grid-cols-2 gap-2">
            <Adelante href={`/taller/unidad/${u.id}/trabajo`} className="tap flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent font-bold text-accent-ink shadow-tarjeta">
              <Wrench className="size-5" />Registrar trabajo
            </Adelante>
            <Adelante href={`/taller/unidad/${u.id}/orden`} className="tap flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold">
              <Plus className="size-5" />Abrir orden
            </Adelante>
          </div>
          {u.estado === 'taller' && <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">La unidad está parada: nadie puede salir hasta que se resuelvan las fallas críticas y las órdenes abiertas.</p>}
        </Seccion>

        <Seccion titulo={`Fallas pendientes · ${lista.length}`}>
          {lista.length ? (
            lista.map((f) => (
              <TarjetaFalla key={f.id} falla={f} urls={urls}>
                {f.estado === 'abierta' && (
                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                    <Adelante href={`/taller/unidad/${u.id}/trabajo?falla=${f.id}`} className="tap flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-ink">Resolver</Adelante>
                    <form action={descartarFalla.bind(null, f.id, u.id)}>
                      <button className="tap h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink-2">Descartar</button>
                    </form>
                  </div>
                )}
              </TarjetaFalla>
            ))
          ) : (
            <Fila><CheckCircle2 className="size-5 text-ok" /><span className="text-ink-2">Sin fallas pendientes</span></Fila>
          )}
        </Seccion>

        {abiertas && abiertas.length > 0 && (
          <Seccion titulo="Órdenes abiertas">
            {abiertas.map((o) => (
              <Adelante key={o.id} href={`/taller/orden/${o.id}`} className="tap">
                <Fila>
                  <ClipboardList className="size-5 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">#{o.numero} · {o.descripcion}</p>
                    <p className="text-sm text-ink-3">Abierta el {fechaCorta(`${o.fecha_ingreso}T12:00`)}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">Cerrar</span>
                </Fila>
              </Adelante>
            ))}
          </Seccion>
        )}

        {chequeo && (
          <Seccion titulo="Último chequeo del chofer">
            <Fila>
              {chequeo.aprobado ? <ShieldCheck className="size-5 shrink-0 text-ok" /> : <ShieldX className="size-5 shrink-0 text-crit" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{chequeo.aprobado ? 'Aprobado' : 'Con falla crítica'}</p>
                <p className="text-sm text-ink-3">{quienChequeo ? `${quienChequeo} · ` : ''}{cuando(chequeo.fecha)}{chequeo.km != null ? ` · ${chequeo.km.toLocaleString('es-AR')} km` : ''}</p>
              </div>
            </Fila>
          </Seccion>
        )}

        <Seccion titulo="Últimos trabajos">
          {trabajos?.length ? (
            trabajos.map((o) => (
              <Fila key={o.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.descripcion}</p>
                  <p className="text-sm text-ink-3">#{o.numero} · {o.fecha_egreso ? fechaCorta(`${o.fecha_egreso}T12:00`) : ''}</p>
                </div>
                <Pildora tipo={o.tipo === 'preventivo' ? 'info' : 'neutro'}>{o.tipo === 'preventivo' ? 'Mantenimiento' : 'Reparación'}</Pildora>
              </Fila>
            ))
          ) : (
            <p className="px-1 text-sm text-ink-3">Todavía no hay trabajos registrados.</p>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
