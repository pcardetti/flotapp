import type { Metadata } from 'next';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Patente, Pildora, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Flota y choferes' };

const TIPO: Record<string, string> = { tractor: 'Tractor', chasis: 'Camión chasis', semirremolque: 'Semirremolque', acoplado: 'Acoplado' };
const ESTADO: Record<string, [React.ComponentProps<typeof Pildora>['tipo'], string]> = {
  operativa: ['ok', 'En servicio'],
  taller: ['warn', 'En taller'],
  baja: ['neutro', 'De baja'],
};

export default async function Flota({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await abrirSeccion(org, 'flota');
  const supabase = await crearClienteServidor();
  const [{ data: unidades }, { data: choferes }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, tipo, marca, modelo, anio, km, estado, chofer:choferes(nombre)').eq('organizacion_id', org).order('dominio'),
    supabase.from('choferes').select('id, nombre, telefono').eq('organizacion_id', org).order('nombre'),
  ]);

  return (
    <>
      <Encabezado titulo="Flota y choferes" bajada={`${unidades?.length ?? 0} unidades · ${choferes?.length ?? 0} choferes`} />
      {!unidades?.length ? (
        <Vacio titulo="Todavía no hay unidades">
          Acá vas a ver tus tractores, chasis y remolques con su patente, kilometraje, chofer asignado y estado. La carga de unidades llega en la próxima etapa.
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
                {unidades.map((u) => {
                  const chofer = Array.isArray(u.chofer) ? u.chofer[0] : u.chofer;
                  const [t, e] = ESTADO[u.estado] ?? ESTADO.operativa;
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2.5"><Patente dominio={u.dominio} /><span><b>{u.marca} {u.modelo}</b>{u.anio ? <span className="block text-xs text-ink-3">{u.anio}</span> : null}</span></span>
                      </td>
                      <td className="py-2.5 pr-3">{TIPO[u.tipo] ?? u.tipo}</td>
                      <td className="py-2.5 pr-3 text-right">{u.km != null ? `${u.km.toLocaleString('es-AR')} km` : '—'}</td>
                      <td className="py-2.5 pr-3">{chofer?.nombre ?? '—'}</td>
                      <td className="py-2.5"><Pildora tipo={t}>{e}</Pildora></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </>
  );
}
