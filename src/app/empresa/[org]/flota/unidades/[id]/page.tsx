import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Aviso, BotonLink, Patente, Pildora, Tarjeta } from '@/components/ui';
import { UUID, abrirSeccion, esGestor } from '@/lib/empresa';
import { fechaCorta } from '@/lib/fechas';
import { ESTADOS_UNIDAD, TIPOS_UNIDAD, tieneMotor, type EstadoUnidad, type TipoUnidad } from '@/lib/flota';
import { codigoLegible, enlaceUnidad, qrSvg } from '@/lib/qr';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { eliminarUnidad, registrarKm } from '../../acciones';
import { Eliminar, FormularioKm } from '../../formularios';

export const metadata: Metadata = { title: 'Unidad' };

const TONO: Record<EstadoUnidad, React.ComponentProps<typeof Pildora>['tipo']> = { operativa: 'ok', taller: 'warn', baja: 'neutro' };
const ORIGEN: Record<string, string> = {
  alta: 'Alta de la unidad', manual: 'Carga manual', edicion: 'Edición', correccion: 'Corrección',
  chequeo: 'Chequeo de salida', viaje: 'Fin de viaje', taller: 'Taller',
};
const AVISOS: Record<string, string> = { creada: 'Unidad agregada.', guardada: 'Cambios guardados.' };

export default async function Unidad({ params, searchParams }: { params: Promise<{ org: string; id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { org, id } = await params;
  const { ok } = await searchParams;
  const { rol } = await abrirSeccion(org, 'flota');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  // El código QR va en una consulta aparte: si la base todavía no tiene la migración 0002, la ficha igual carga.
  const [{ data: u, error }, { data: lecturas, error: e2 }, { data: qr }] = await Promise.all([
    supabase
      .from('unidades')
      .select('id, dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, cargas_peligrosas, chofer:choferes(id, nombre, telefono)')
      .eq('id', id)
      .eq('organizacion_id', org)
      .maybeSingle(),
    supabase.from('lecturas_km').select('id, km, fecha, origen').eq('unidad_id', id).eq('organizacion_id', org).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(12),
    supabase.from('unidades').select('qr_token').eq('id', id).eq('organizacion_id', org).maybeSingle(),
  ]);
  avisarError('unidad', error);
  avisarError('unidad/lecturas', e2);
  if (!u) notFound();
  const codigo = (qr as { qr_token?: string } | null)?.qr_token;
  const svg = codigo ? await qrSvg(await enlaceUnidad(codigo)) : null;

  const chofer = Array.isArray(u.chofer) ? u.chofer[0] : u.chofer;
  const edita = esGestor(rol);
  const base = `/empresa/${org}/flota`;
  const datos: [string, React.ReactNode][] = [
    ['Tipo', TIPOS_UNIDAD[u.tipo as TipoUnidad]],
    ['Año', u.anio ?? '—'],
    ['Kilometraje', u.km != null ? `${u.km.toLocaleString('es-AR')} km` : '—'],
    ['Jurisdicción', u.jurisdiccion],
    ['Chofer', chofer ? `${chofer.nombre}${chofer.telefono ? ` · ${chofer.telefono}` : ''}` : 'Sin asignar'],
    ['Cargas peligrosas', u.cargas_peligrosas ? 'Sí' : 'No'],
  ];

  return (
    <>
      <Link href={base} className="text-sm font-semibold text-accent hover:underline">← Flota y choferes</Link>
      <Encabezado titulo={`${u.marca} ${u.modelo}`}>
        {edita && <BotonLink href={`${base}/unidades/${id}/editar`} variante="secundario">Editar</BotonLink>}
      </Encabezado>
      <div className="-mt-3 flex flex-wrap items-center gap-3">
        <Patente dominio={u.dominio} />
        <Pildora tipo={TONO[u.estado as EstadoUnidad]}>{ESTADOS_UNIDAD[u.estado as EstadoUnidad]}</Pildora>
      </div>
      {ok && AVISOS[ok] && <Aviso tipo="ok">{AVISOS[ok]}</Aviso>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Datos</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {datos.map(([t, v]) => (
              <div key={t} className="flex min-w-0 flex-col gap-0.5">
                <dt className="eyebrow">{t}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>

        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Kilometraje</h2>
          {edita && (tieneMotor(u.tipo) || u.km != null) && <FormularioKm accion={registrarKm.bind(null, org, id)} />}
          {lecturas?.length ? (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                    <th className="py-2 pr-3 font-semibold">Fecha</th>
                    <th className="py-2 pr-3 text-right font-semibold">Kilometraje</th>
                    <th className="py-2 font-semibold">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturas.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">{fechaCorta(`${l.fecha}T12:00:00`)}</td>
                      <td className="py-2 pr-3 text-right">{l.km.toLocaleString('es-AR')} km</td>
                      <td className="py-2 text-ink-2">{ORIGEN[l.origen] ?? l.origen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-3">{tieneMotor(u.tipo) ? 'Todavía no hay lecturas registradas.' : 'Los remolques sin odómetro no llevan kilometraje.'}</p>
          )}
        </Tarjeta>
      </div>

      <Tarjeta>
        {codigo && svg ? (
          <div className="flex flex-wrap items-center gap-5">
            <div className="w-32 shrink-0 rounded-xl border border-line bg-white p-2.5 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <h2 className="font-display text-xl font-bold">QR de la unidad</h2>
              <p className="text-sm text-ink-2">
                El chofer lo escanea para hacer el chequeo y arrancar el viaje. El mecánico, para ver las fallas y registrar trabajos.
              </p>
              <p className="font-display text-lg font-bold tracking-[0.2em]">{codigoLegible(codigo)}</p>
              <BotonLink href={`/imprimir/qr/${org}?u=${id}`} variante="secundario">Imprimir etiqueta</BotonLink>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">QR de la unidad</h2>
            <p className="text-sm text-ink-2">El código QR aparece cuando se ejecuta la migración 0002 en Supabase.</p>
          </>
        )}
      </Tarjeta>

      {rol === 'admin' && (
        <Tarjeta className="border-dashed">
          <h2 className="font-display text-xl font-bold">Eliminar unidad</h2>
          <p className="text-sm text-ink-2">
            Si la unidad dejó de usarse, conviene marcarla como <b>De baja</b> desde Editar: así conserva su historia. Eliminar borra también su
            historial de kilometraje.
          </p>
          <Eliminar
            accion={eliminarUnidad.bind(null, org, id)}
            boton="Eliminar unidad"
            pregunta={`¿Eliminar ${u.dominio}?`}
            detalle="No se puede deshacer. Si tiene viajes, órdenes de trabajo o neumáticos montados, no se va a poder eliminar."
          />
        </Tarjeta>
      )}
    </>
  );
}
