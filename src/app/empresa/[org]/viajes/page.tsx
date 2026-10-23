import { Route, ShieldCheck, ShieldX } from 'lucide-react';
import type { Metadata } from 'next';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Patente, Pildora, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { cuando, duracion } from '@/lib/fechas';
import { numero } from '@/lib/formato';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Viajes' };

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

export default async function Viajes({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await abrirSeccion(org, 'viajes');
  const supabase = await crearClienteServidor();
  const { data: viajes, error } = await supabase.from('viajes')
    .select('id, estado, inicio, fin, km_inicio, km_fin, combustible_inicio, combustible_fin, destino, unidad:unidades(id, dominio, marca, modelo), chofer:choferes(nombre), chequeo:chequeos(aprobado, items)')
    .eq('organizacion_id', org).order('inicio', { ascending: false }).limit(100);
  avisarError('viajes', error);
  const enCurso = (viajes ?? []).filter((v) => v.estado === 'en_curso');
  const terminados = (viajes ?? []).filter((v) => v.estado !== 'en_curso');

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Viajes" bajada={`${enCurso.length} en curso`} />
      {error && <p className="rounded-xl bg-crit-soft px-4 py-3 text-sm text-crit">No pudimos cargar los viajes. Si todavía no ejecutaste la migración 0002 en Supabase, hacelo y recargá.</p>}

      {enCurso.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {enCurso.map((v) => {
            const u = uno(v.unidad as Uno<{ dominio: string; marca: string; modelo: string }>);
            return (
              <div key={v.id} className="aparecer flex flex-col gap-2 rounded-2xl border border-accent bg-accent-soft p-4">
                <div className="flex items-center justify-between gap-2"><Patente dominio={u?.dominio ?? '—'} /><Pildora tipo="info">En viaje · {duracion(v.inicio)}</Pildora></div>
                <p className="font-display text-xl font-bold leading-tight">{v.destino ? `Hacia ${v.destino}` : `${u?.marca} ${u?.modelo}`}</p>
                <p className="text-sm text-ink-2">{uno(v.chofer as Uno<{ nombre: string }>)?.nombre ?? 'Chofer'} · salió {cuando(v.inicio)} con {numero(v.km_inicio)} km</p>
              </div>
            );
          })}
        </section>
      )}

      {terminados.length ? (
        <Tarjeta>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 pr-3 font-semibold">Chofer</th>
                  <th className="py-2 pr-3 font-semibold">Salida</th>
                  <th className="py-2 pr-3 font-semibold">Duración</th>
                  <th className="py-2 pr-3 text-right font-semibold">Km</th>
                  <th className="py-2 pr-3 font-semibold">Chequeo</th>
                  <th className="py-2 font-semibold">Destino</th>
                </tr>
              </thead>
              <tbody>
                {terminados.map((v) => {
                  const u = uno(v.unidad as Uno<{ dominio: string }>);
                  const ch = uno(v.chequeo as Uno<{ aprobado: boolean; items: Record<string, { estado: string }> }>);
                  const problemas = ch ? Object.values(ch.items ?? {}).filter((i) => i.estado === 'problema').length : 0;
                  return (
                    <tr key={v.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3"><Patente dominio={u?.dominio ?? '—'} /></td>
                      <td className="py-2.5 pr-3">{uno(v.chofer as Uno<{ nombre: string }>)?.nombre ?? '—'}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{cuando(v.inicio)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{v.fin ? duracion(v.inicio, v.fin) : '—'}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{v.km_fin != null ? numero(v.km_fin - v.km_inicio) : '—'}</td>
                      <td className="py-2.5 pr-3">
                        {ch ? (
                          <span className="flex items-center gap-1.5">
                            {problemas ? <ShieldX className="size-4 text-warn" /> : <ShieldCheck className="size-4 text-ok" />}
                            {problemas ? `${problemas} ${problemas === 1 ? 'observación' : 'observaciones'}` : 'Todo bien'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 text-ink-2">{v.destino ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : (
        !enCurso.length && !error && (
          <Vacio titulo="Todavía no hay viajes">
            <span className="flex items-center gap-2"><Route className="size-5" />Los viajes empiezan cuando un chofer escanea el QR de la unidad con la app Chofer y completa el chequeo de salida.</span>
          </Vacio>
        )
      )}
    </Pantalla>
  );
}
