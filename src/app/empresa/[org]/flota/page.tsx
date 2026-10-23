import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Aviso, BotonLink, Patente, Pildora, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { ESTADOS_UNIDAD, TIPOS_UNIDAD, type EstadoUnidad, type TipoUnidad } from '@/lib/flota';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Flota y choferes' };

const TONO: Record<EstadoUnidad, React.ComponentProps<typeof Pildora>['tipo']> = { operativa: 'ok', taller: 'warn', baja: 'neutro' };

const AVISOS: Record<string, string> = {
  'unidad-eliminada': 'La unidad se eliminó.',
  'chofer-creado': 'Chofer agregado.',
  'chofer-guardado': 'Cambios del chofer guardados.',
  'chofer-eliminado': 'El chofer se eliminó.',
};

export default async function Flota({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { org } = await params;
  const { ok } = await searchParams;
  const { rol } = await abrirSeccion(org, 'flota');
  const edita = rol === 'admin' || rol === 'jefe_taller';
  const supabase = await crearClienteServidor();
  const [{ data: unidades, error: e1 }, { data: choferes, error: e2 }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, tipo, marca, modelo, anio, km, estado, chofer_id').eq('organizacion_id', org).order('dominio'),
    supabase.from('choferes').select('id, nombre, telefono').eq('organizacion_id', org).order('nombre'),
  ]);
  avisarError('flota/unidades', e1);
  avisarError('flota/choferes', e2);
  const nombreChofer = new Map((choferes ?? []).map((c) => [c.id, c.nombre]));
  const base = `/empresa/${org}/flota`;
  const activas = (unidades ?? []).filter((u) => u.estado !== 'baja').length;

  return (
    <>
      <Encabezado titulo="Flota y choferes" bajada={`${activas} unidades activas · ${choferes?.length ?? 0} choferes`}>
        {edita && (
          <>
            <BotonLink href={`${base}/choferes/nuevo`} variante="secundario">Agregar chofer</BotonLink>
            <BotonLink href={`${base}/unidades/nueva`}>Agregar unidad</BotonLink>
          </>
        )}
      </Encabezado>
      {ok && AVISOS[ok] && <Aviso tipo="ok">{AVISOS[ok]}</Aviso>}
      {(e1 || e2) && <Aviso tipo="error">No pudimos cargar todos los datos. Recargá la página en unos segundos.</Aviso>}

      {!unidades?.length ? (
        <Vacio titulo="Todavía no hay unidades">
          Cargá tus tractores, chasis, semirremolques y acoplados con su patente y kilometraje. Después vas a poder asignarles chofer, plan de mantenimiento,
          documentos y neumáticos.
          {edita && <div className="mt-3"><BotonLink href={`${base}/unidades/nueva`}>Agregar la primera unidad</BotonLink></div>}
        </Vacio>
      ) : (
        <Tarjeta>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 text-right font-semibold">Kilometraje</th>
                  <th className="py-2 pr-3 font-semibold">Chofer</th>
                  <th className="py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link href={`${base}/unidades/${u.id}`} className="group flex items-center gap-2.5">
                        <Patente dominio={u.dominio} />
                        <span>
                          <b className="group-hover:underline">{u.marca} {u.modelo}</b>
                          {u.anio ? <span className="block text-xs text-ink-3">{u.anio}</span> : null}
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{TIPOS_UNIDAD[u.tipo as TipoUnidad] ?? u.tipo}</td>
                    <td className="py-2.5 pr-3 text-right">{u.km != null ? `${u.km.toLocaleString('es-AR')} km` : '—'}</td>
                    <td className="py-2.5 pr-3">{(u.chofer_id && nombreChofer.get(u.chofer_id)) ?? <span className="text-ink-3">Sin asignar</span>}</td>
                    <td className="py-2.5"><Pildora tipo={TONO[u.estado as EstadoUnidad]}>{ESTADOS_UNIDAD[u.estado as EstadoUnidad]}</Pildora></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      <section id="choferes" className="flex flex-col gap-3 scroll-mt-24">
        <h2 className="font-display text-2xl font-bold">Choferes</h2>
        {!choferes?.length ? (
          <Vacio titulo="Todavía no hay choferes">
            Cargá a tus choferes para asignarlos a las unidades. Más adelante vas a seguir sus licencias y cursos desde Vencimientos.
            {edita && <div className="mt-3"><BotonLink href={`${base}/choferes/nuevo`} variante="secundario">Agregar el primer chofer</BotonLink></div>}
          </Vacio>
        ) : (
          <Tarjeta>
            <ul className="flex flex-col">
              {choferes.map((c) => {
                const asignadas = (unidades ?? []).filter((u) => u.chofer_id === c.id);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate">{c.nombre}</b>
                      <span className="text-sm text-ink-3">{c.telefono ?? 'Sin teléfono'}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {asignadas.length ? asignadas.map((u) => <Patente key={u.id} dominio={u.dominio} />) : <span className="text-sm text-ink-3">Sin unidad</span>}
                      {edita && <Link href={`${base}/choferes/${c.id}`} className="ml-1 text-sm font-semibold text-accent hover:underline">Editar</Link>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        )}
      </section>
    </>
  );
}
