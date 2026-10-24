import { Paperclip, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import { FormConfirmado } from '@/components/confirmar';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Desplegable, Patente, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { diaCorto, fechaCorta, hoyISO } from '@/lib/fechas';
import { firmarFotos } from '@/lib/fotos';
import { NOMBRE_CATEGORIA, numero, pesos, serieDe } from '@/lib/formato';
import { puede } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { eliminarGasto } from './acciones';
import { FormGasto } from './formulario';

export const metadata: Metadata = { title: 'Gastos' };

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

// En el celular es fácil tocar el tacho sin querer: borrar pide confirmación.
function BorrarGasto({ accion }: { accion: () => Promise<{ error?: string }> }) {
  return (
    <FormConfirmado accion={accion} pregunta="¿Eliminar este gasto?" detalle="Deja de contar en el tablero y en los totales. No se puede deshacer." hecho="Gasto eliminado">
      <button aria-label="Eliminar gasto" className="tap grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-crit-soft hover:text-crit"><Trash2 className="size-4" /></button>
    </FormConfirmado>
  );
}

export default async function Gastos({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const empresa = await abrirSeccion(org, 'gastos');
  const supabase = await crearClienteServidor();
  const [{ data: gastos, error }, { data: unidades }, { data: choferes }] = await Promise.all([
    supabase.from('gastos').select('id, categoria, monto, litros, fecha, descripcion, foto, unidad:unidades(dominio), chofer:choferes(nombre)')
      .eq('organizacion_id', org).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(150),
    supabase.from('unidades').select('id, dominio').eq('organizacion_id', org).neq('estado', 'baja').order('dominio'),
    supabase.from('choferes').select('id, nombre').eq('organizacion_id', org).order('nombre'),
  ]);
  avisarError('gastos', error);
  const urls = await firmarFotos((gastos ?? []).map((g) => g.foto));
  const mes = hoyISO().slice(0, 7);
  const delMes = (gastos ?? []).filter((g) => g.fecha.startsWith(mes)).reduce((a, g) => a + Number(g.monto), 0);
  const edita = puede(empresa, 'gastos.editar');

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Gastos" bajada={`Este mes ${pesos(delMes)}. El mantenimiento se suma solo desde el taller.`} />
      {edita && (
        <Desplegable titulo="Agregar gasto" abierto={!gastos?.length}>
          <FormGasto org={org} hoy={hoyISO()} unidades={unidades ?? []} choferes={choferes ?? []} />
        </Desplegable>
      )}
      {gastos?.length ? (
        <Tarjeta>
          {/* En el celular, una lista; en pantallas anchas, la tabla completa. */}
          <ul className="flex flex-col md:hidden">
            {gastos.map((g) => {
              const u = uno(g.unidad as Uno<{ dominio: string }>);
              const chofer = uno(g.chofer as Uno<{ nombre: string }>)?.nombre;
              return (
                <li key={g.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <i className="size-2.5 shrink-0 rounded-sm" style={{ background: serieDe(g.categoria).color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{NOMBRE_CATEGORIA[g.categoria] ?? g.categoria}{g.descripcion && <span className="font-normal text-ink-3"> · {g.descripcion}</span>}</p>
                    <p className="truncate text-sm text-ink-3">
                      {diaCorto(g.fecha)} · {u?.dominio ?? 'General'}{chofer ? ` · ${chofer}` : ''}{g.litros ? ` · ${numero(Number(g.litros), 1)} l` : ''}
                    </p>
                  </div>
                  <b className="whitespace-nowrap tabular-nums">{pesos(Number(g.monto))}</b>
                  {g.foto && urls[g.foto] && <a href={urls[g.foto]} target="_blank" rel="noreferrer" aria-label="Ver comprobante" className="tap -mr-1 grid size-9 place-items-center rounded-lg text-ink-2"><Paperclip className="size-4" /></a>}
                  {edita && <BorrarGasto accion={eliminarGasto.bind(null, org, g.id)} />}
                </li>
              );
            })}
          </ul>
          <div className="-mx-5 hidden overflow-x-auto px-5 md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Categoría</th>
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 pr-3 font-semibold">Chofer</th>
                  <th className="py-2 pr-3 text-right font-semibold">Litros</th>
                  <th className="py-2 pr-3 text-right font-semibold">Importe</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => {
                  const u = uno(g.unidad as Uno<{ dominio: string }>);
                  return (
                    <tr key={g.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{fechaCorta(`${g.fecha}T12:00`)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-sm" style={{ background: serieDe(g.categoria).color }} />{NOMBRE_CATEGORIA[g.categoria] ?? g.categoria}{g.descripcion && <span className="truncate text-ink-3">· {g.descripcion}</span>}</span>
                      </td>
                      <td className="py-2.5 pr-3">{u ? <Patente dominio={u.dominio} /> : <span className="text-ink-3">General</span>}</td>
                      <td className="py-2.5 pr-3">{uno(g.chofer as Uno<{ nombre: string }>)?.nombre ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{g.litros ? numero(Number(g.litros), 1) : '—'}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{pesos(Number(g.monto))}</td>
                      <td className="py-2.5">
                        <span className="flex items-center justify-end gap-1">
                          {g.foto && urls[g.foto] && <a href={urls[g.foto]} target="_blank" rel="noreferrer" aria-label="Ver comprobante" className="tap grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"><Paperclip className="size-4" /></a>}
                          {edita && <BorrarGasto accion={eliminarGasto.bind(null, org, g.id)} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : (
        !error && <Vacio titulo="Todavía no hay gastos">Los choferes cargan combustible, peajes y viáticos desde su app. Acá podés sumar seguros, patentes, multas y cualquier otro gasto.</Vacio>
      )}
    </Pantalla>
  );
}
