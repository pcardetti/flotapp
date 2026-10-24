import { CheckCircle2, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { TarjetaFalla, type FallaVista } from '@/components/falla';
import { Pantalla } from '@/components/pantalla';
import { BotonLink, Patente, Pildora, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { fechaCorta } from '@/lib/fechas';
import { firmarFotos } from '@/lib/fotos';
import { cuantas, pesos } from '@/lib/formato';
import { puede } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Taller' };

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

export default async function TallerFlota({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const empresa = await abrirSeccion(org, 'taller');
  const supabase = await crearClienteServidor();
  const [{ data: fallas, error }, { data: abiertas }, { data: cerradas }] = await Promise.all([
    supabase.from('fallas').select('id, sistema, descripcion, gravedad, estado, fotos, creada_en, unidad:unidades(id, dominio), chofer:choferes(nombre)')
      .eq('organizacion_id', org).in('estado', ['abierta', 'en_reparacion']).order('gravedad', { ascending: false }).order('creada_en', { ascending: false }),
    supabase.from('ordenes').select('id, numero, descripcion, fecha_ingreso, deja_fuera_servicio, unidad:unidades(dominio)').eq('organizacion_id', org).neq('estado', 'cerrada').order('fecha_ingreso'),
    supabase.from('ordenes').select('id, numero, tipo, descripcion, fecha_egreso, repuestos, mano_obra, fotos, unidad:unidades(dominio)').eq('organizacion_id', org).eq('estado', 'cerrada')
      .order('fecha_egreso', { ascending: false }).limit(15),
  ]);
  avisarError('taller-flota', error);
  const urls = await firmarFotos((fallas ?? []).flatMap((f) => f.fotos as string[]));
  const puedeOperar = puede(empresa, 'taller.operar');

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Taller" bajada={`${cuantas(fallas?.length ?? 0, 'falla pendiente', 'fallas pendientes')} · ${cuantas(abiertas?.length ?? 0, 'orden abierta', 'órdenes abiertas')}`}>
        {puedeOperar && <BotonLink href="/taller">Abrir app Taller</BotonLink>}
      </Encabezado>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">Fallas pendientes</h2>
        {fallas?.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fallas.map((f) => {
              const u = uno(f.unidad as Uno<{ id: string; dominio: string }>);
              return (
                <TarjetaFalla key={f.id} falla={{ ...f, chofer: uno(f.chofer as Uno<{ nombre: string }>)?.nombre ?? null } as FallaVista} urls={urls}>
                  {u && (
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                      <Patente dominio={u.dominio} />
                      {puedeOperar && f.estado === 'abierta' && <Link href={`/taller/unidad/${u.id}/trabajo?falla=${f.id}`} className="text-sm font-semibold text-accent hover:underline">Resolver</Link>}
                    </div>
                  )}
                </TarjetaFalla>
              );
            })}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-ink-2"><CheckCircle2 className="size-5 text-ok" />No hay fallas pendientes.</p>
        )}
      </section>

      {abiertas && abiertas.length > 0 && (
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Órdenes abiertas</h2>
          <ul className="flex flex-col">
            {abiertas.map((o) => (
              <li key={o.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <Patente dominio={uno(o.unidad as Uno<{ dominio: string }>)?.dominio ?? '—'} />
                <span className="min-w-0 flex-1 truncate"><b>#{o.numero}</b> {o.descripcion}</span>
                <span className="text-sm text-ink-3">desde {fechaCorta(`${o.fecha_ingreso}T12:00`)}</span>
                {o.deja_fuera_servicio && <Pildora tipo="warn">Parada</Pildora>}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta>
        <h2 className="font-display text-xl font-bold">Últimos trabajos</h2>
        {cerradas?.length ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="py-2 pr-3 font-semibold">N.º</th>
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 pr-3 font-semibold">Trabajo</th>
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 text-right font-semibold">Costo</th>
                  <th className="py-2 font-semibold">Fotos</th>
                </tr>
              </thead>
              <tbody>
                {cerradas.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-semibold">{o.numero}</td>
                    <td className="py-2.5 pr-3"><Patente dominio={uno(o.unidad as Uno<{ dominio: string }>)?.dominio ?? '—'} /></td>
                    <td className="py-2.5 pr-3"><span className="flex items-center gap-2">{o.descripcion}<Pildora tipo={o.tipo === 'preventivo' ? 'info' : 'neutro'}>{o.tipo === 'preventivo' ? 'Mantenimiento' : 'Reparación'}</Pildora></span></td>
                    <td className="py-2.5 pr-3">{o.fecha_egreso ? fechaCorta(`${o.fecha_egreso}T12:00`) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{pesos(Number(o.repuestos) + Number(o.mano_obra))}</td>
                    <td className="py-2.5 text-ink-3">{(o.fotos as string[]).length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-3"><Wrench className="size-4" />Los trabajos que registre el taller van a aparecer acá con su costo.</p>
        )}
      </Tarjeta>
    </Pantalla>
  );
}
