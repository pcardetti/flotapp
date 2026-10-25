import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Gauge, Route, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Toast } from '@/components/controles';
import { TarjetaFalla, type FallaVista } from '@/components/falla';
import { Ranking } from '@/components/graficos';
import { SelectorPeriodo } from '@/components/periodo';
import { BotonLink, Patente, Pildora, Tarjeta } from '@/components/ui';
import { UUID, abrirSeccion } from '@/lib/empresa';
import { cuando, diaCorto, diasHasta, fechaCorta, hoyISO } from '@/lib/fechas';
import { contarPorTipo, costosDelPeriodo, esTipoEvento, estadoVencimiento, lineaDeTiempo, TIPOS_EVENTO, type Evento, type OrdenFila, type TipoEvento } from '@/lib/ficha';
import { ESTADOS_UNIDAD, TIPOS_UNIDAD, tieneMotor, type EstadoUnidad, type TipoUnidad } from '@/lib/flota';
import { firmarFotos } from '@/lib/fotos';
import { cuantas, km, numero, pesos } from '@/lib/formato';
import { PERIODOS, periodoValido, rango } from '@/lib/periodos';
import { puede } from '@/lib/permisos';
import { codigoLegible, enlaceUnidad, qrSvg } from '@/lib/qr';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { eliminarUnidad, registrarKm } from '../../acciones';
import { Eliminar, FormularioKm } from '../../formularios';

export const metadata: Metadata = { title: 'Unidad' };

const TONO: Record<EstadoUnidad, React.ComponentProps<typeof Pildora>['tipo']> = { operativa: 'ok', taller: 'warn', baja: 'neutro' };
const AVISOS: Record<string, string> = { creada: 'Unidad agregada', guardada: 'Cambios guardados', falla: 'Falla reportada' };
const ICONO: Record<TipoEvento, typeof Wrench> = { falla: AlertTriangle, trabajo: Wrench, orden: ClipboardList, viaje: Route, km: Gauge };
// El historial muestra primero lo último; el resto, con "Ver todo".
const VISIBLES = 20;

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="eyebrow">{titulo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span className="eyebrow">{titulo}</span>
      <span className="truncate font-display text-[1.75rem] font-bold leading-none">{valor}</span>
      {detalle && <span className="text-sm text-ink-3">{detalle}</span>}
    </div>
  );
}

function FilaEvento({ e, ultimo }: { e: Evento; ultimo: boolean }) {
  const Icono = ICONO[e.tipo];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* La línea vertical une los íconos de un evento al siguiente. */}
      {!ultimo && <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-px bg-line" />}
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${e.tipo === 'falla' ? 'bg-crit-soft text-crit' : 'bg-surface-2 text-ink-2'}`}>
        <Icono className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{e.titulo}</p>
          {e.detalle && <p className="text-sm text-ink-2">{e.detalle}</p>}
          <p className="text-xs text-ink-3">
            <span className="sr-only">{TIPOS_EVENTO[e.tipo]} · </span>{e.soloDia ? diaCorto(e.momento.slice(0, 10)) : cuando(e.momento)}
          </p>
        </div>
        {(e.pildoras.length > 0 || e.monto !== undefined) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {e.pildoras.map((p) => <Pildora key={p.texto} tipo={p.tono}>{p.texto}</Pildora>)}
            {e.monto !== undefined && <span className="text-sm font-semibold tabular-nums">{pesos(e.monto)}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

export default async function Unidad({ params, searchParams }: {
  params: Promise<{ org: string; id: string }>;
  searchParams: Promise<{ ok?: string; p?: string; h?: string; ver?: string }>;
}) {
  const { org, id } = await params;
  const { ok, p: periodo, h, ver } = await searchParams;
  const empresa = await abrirSeccion(org, 'flota');
  if (!UUID.test(id)) notFound();
  const p = periodoValido(periodo);
  const filtro = esTipoEvento(h) ? h : null;
  const hoy = hoyISO();
  const { desde, hasta } = rango(p, hoy);
  const supabase = await crearClienteServidor();
  // El código QR va en una consulta aparte: si la base todavía no tiene la migración 0002, la ficha igual carga.
  const [
    { data: u, error }, { data: qr }, { data: fallas, error: e1 }, { data: ordenes, error: e2 }, { data: viajes, error: e3 },
    { data: lecturas, error: e4 }, { data: previa }, { data: gastos, error: e5 }, { data: docs, error: e6 },
  ] = await Promise.all([
    supabase
      .from('unidades')
      .select('id, dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, cargas_peligrosas, chofer:choferes(id, nombre, telefono)')
      .eq('id', id)
      .eq('organizacion_id', org)
      .maybeSingle(),
    supabase.from('unidades').select('qr_token').eq('id', id).eq('organizacion_id', org).maybeSingle(),
    supabase.from('fallas').select('id, sistema, descripcion, gravedad, estado, fotos, creada_en, chofer:choferes(nombre)')
      .eq('unidad_id', id).eq('organizacion_id', org).order('creada_en', { ascending: false }).limit(100),
    supabase.from('ordenes').select('id, numero, tipo, descripcion, trabajo, estado, fecha_ingreso, fecha_egreso, repuestos, mano_obra, deja_fuera_servicio')
      .eq('unidad_id', id).eq('organizacion_id', org).order('fecha_ingreso', { ascending: false }).limit(200),
    supabase.from('viajes').select('id, estado, inicio, fin, km_inicio, km_fin, destino, chofer:choferes(nombre)')
      .eq('unidad_id', id).eq('organizacion_id', org).order('inicio', { ascending: false }).limit(100),
    supabase.from('lecturas_km').select('id, km, fecha, origen, creado_en').eq('unidad_id', id).eq('organizacion_id', org)
      .order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(200),
    // La última lectura antes del período, para contar los km recorridos aunque el historial cargado no llegue tan atrás.
    supabase.from('lecturas_km').select('id, km, fecha, origen').eq('unidad_id', id).eq('organizacion_id', org).lt('fecha', desde)
      .order('fecha', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('gastos').select('categoria, monto, litros, fecha').eq('unidad_id', id).eq('organizacion_id', org).gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('id, vence, numero, tipo:tipos_documento(nombre, aviso_dias)').eq('unidad_id', id).eq('organizacion_id', org).order('vence'),
  ]);
  avisarError('unidad', error);
  avisarError('unidad/fallas', e1);
  avisarError('unidad/ordenes', e2);
  avisarError('unidad/viajes', e3);
  avisarError('unidad/lecturas', e4);
  avisarError('unidad/gastos', e5);
  avisarError('unidad/documentos', e6);
  if (!u) notFound();
  const codigo = (qr as { qr_token?: string } | null)?.qr_token;
  const svg = codigo ? await qrSvg(await enlaceUnidad(codigo)) : null;

  const chofer = uno(u.chofer as Uno<{ id: string; nombre: string; telefono: string | null }>);
  const edita = puede(empresa, 'flota.editar');
  const base = `/empresa/${org}/flota`;
  const ficha = `${base}/unidades/${id}`;
  const motor = tieneMotor(u.tipo);

  // ── Requiere atención ──
  const pendientes = (fallas ?? [])
    .filter((f) => f.estado === 'abierta' || f.estado === 'en_reparacion')
    .map((f) => ({ ...f, chofer: uno(f.chofer as Uno<{ nombre: string }>)?.nombre ?? null }) as FallaVista)
    .sort((a, b) => (a.gravedad === 'critica' ? 0 : 1) - (b.gravedad === 'critica' ? 0 : 1));
  const urls = await firmarFotos(pendientes.flatMap((f) => f.fotos));
  const enTaller = (ordenes ?? []).filter((o) => o.estado !== 'cerrada');
  const vencimientos = (docs ?? [])
    .map((d) => {
      const t = uno(d.tipo as Uno<{ nombre: string; aviso_dias: number | null }>);
      const dias = diasHasta(d.vence);
      return { id: d.id as string, nombre: t?.nombre ?? 'Documento', vence: d.vence as string, dias, estado: estadoVencimiento(dias, t?.aviso_dias ?? 30) };
    })
    .filter((d) => d.estado !== 'ok');
  const nada = !pendientes.length && !enTaller.length && !vencimientos.length;

  // ── Historial ──
  const eventos = lineaDeTiempo({
    fallas: (fallas ?? []).map((f) => ({ ...f, chofer: uno(f.chofer as Uno<{ nombre: string }>)?.nombre ?? null })),
    ordenes: (ordenes ?? []) as OrdenFila[],
    viajes: (viajes ?? []).map((v) => ({ ...v, chofer: uno(v.chofer as Uno<{ nombre: string }>)?.nombre ?? null })),
    lecturas: lecturas ?? [],
  });
  const cuenta = contarPorTipo(eventos);
  const filtrados = filtro ? eventos.filter((e) => e.tipo === filtro) : eventos;
  const todo = ver === 'todo';
  const visibles = todo ? filtrados : filtrados.slice(0, VISIBLES);
  const consulta = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries({ p: periodo ? p : null, h: filtro, ...extra }).filter((e): e is [string, string] => Boolean(e[1])));
    return q.size ? `?${q}` : ficha;
  };

  // ── Costos ──
  const costos = costosDelPeriodo({
    gastos: gastos ?? [],
    ordenes: (ordenes ?? []) as OrdenFila[],
    lecturas: [...(lecturas ?? []), ...(previa ? [previa] : [])],
    desde,
    hasta,
  });
  const nombrePeriodo = PERIODOS.find((x) => x.clave === p)!.texto.toLowerCase();

  const datos: [string, React.ReactNode][] = [
    ['Tipo', TIPOS_UNIDAD[u.tipo as TipoUnidad]],
    ['Marca y modelo', `${u.marca} ${u.modelo}`],
    ['Año', u.anio ?? '—'],
    ['Jurisdicción', u.jurisdiccion],
    ['Chofer', chofer ? `${chofer.nombre}${chofer.telefono ? ` · ${chofer.telefono}` : ''}` : 'Sin asignar'],
    ['Cargas peligrosas', u.cargas_peligrosas ? 'Sí' : 'No'],
  ];

  return (
    <>
      <Link href={base} className="text-sm font-semibold text-accent hover:underline">← Flota y choferes</Link>

      {/* ── Encabezado ── */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Patente dominio={u.dominio} />
              <Pildora tipo={TONO[u.estado as EstadoUnidad]}>{ESTADOS_UNIDAD[u.estado as EstadoUnidad]}</Pildora>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{u.marca} {u.modelo}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {edita && <BotonLink href={`${ficha}/falla`}>Reportar falla</BotonLink>}
            {edita && <BotonLink href={`${ficha}/editar`} variante="secundario">Editar</BotonLink>}
            {codigo && puede(empresa, 'qr.imprimir') && <BotonLink href={`/imprimir/qr/${org}?u=${id}`} variante="secundario">Imprimir QR</BotonLink>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap">
          <Dato titulo="Chofer">{chofer?.nombre ?? <span className="text-ink-3">Sin asignar</span>}</Dato>
          <Dato titulo="Kilometraje">{u.km != null ? km(u.km) : <span className="text-ink-3">{motor ? 'Sin lecturas' : 'Sin odómetro'}</span>}</Dato>
          <Dato titulo="Tipo">{TIPOS_UNIDAD[u.tipo as TipoUnidad]}{u.anio ? ` · ${u.anio}` : ''}</Dato>
        </dl>
      </header>
      <Toast mensaje={ok ? AVISOS[ok] : null} />

      {/* ── Requiere atención ── */}
      {nada ? (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-ink-2">
          <CheckCircle2 className="size-5 shrink-0 text-ok" />Todo en orden: sin fallas abiertas ni documentos por vencer.
        </p>
      ) : (
        <Tarjeta className={pendientes.some((f) => f.gravedad === 'critica') || vencimientos.some((d) => d.estado === 'vencido') ? 'border-crit' : ''}>
          <h2 className="font-display text-xl font-bold">Requiere atención</h2>
          {pendientes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="eyebrow">{cuantas(pendientes.length, 'falla abierta', 'fallas abiertas')}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {pendientes.map((f) => (
                  <TarjetaFalla key={f.id} falla={f} urls={urls}>
                    {puede(empresa, 'taller.operar') && f.estado === 'abierta' && (
                      <Link href={`/taller/unidad/${id}/trabajo?falla=${f.id}`} className="self-start text-sm font-semibold text-accent hover:underline">Resolver</Link>
                    )}
                  </TarjetaFalla>
                ))}
              </div>
            </div>
          )}
          {enTaller.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="eyebrow">En el taller</h3>
              <ul className="flex flex-col">
                {enTaller.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <ClipboardList className="size-5 shrink-0 text-ink-3" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Orden #{o.numero} · {o.descripcion}</p>
                      <p className="text-sm text-ink-3">Abierta el {fechaCorta(`${o.fecha_ingreso}T12:00:00`)}</p>
                    </div>
                    {o.deja_fuera_servicio && <Pildora tipo="warn">Fuera de servicio</Pildora>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {vencimientos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="eyebrow">Vencimientos</h3>
              <ul className="flex flex-col">
                {vencimientos.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <CalendarClock className={`size-5 shrink-0 ${d.estado === 'vencido' ? 'text-crit' : 'text-warn'}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{d.nombre}</p>
                      <p className="text-sm text-ink-3">{d.estado === 'vencido' ? 'Venció' : 'Vence'} el {fechaCorta(`${d.vence}T12:00:00`)}</p>
                    </div>
                    <Pildora tipo={d.estado === 'vencido' ? 'crit' : 'warn'}>
                      {d.dias < 0 ? `Hace ${cuantas(-d.dias, 'día', 'días')}` : d.dias === 0 ? 'Vence hoy' : `En ${cuantas(d.dias, 'día', 'días')}`}
                    </Pildora>
                  </li>
                ))}
              </ul>
              <Link href={`/empresa/${org}/vencimientos`} className="self-start text-sm font-semibold text-accent hover:underline">Renovar en Vencimientos</Link>
            </div>
          )}
        </Tarjeta>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* ── Historial ── */}
        <Tarjeta>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Historial</h2>
            <span className="text-sm text-ink-3">{cuantas(filtrados.length, 'registro', 'registros')}</span>
          </div>
          <nav className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" aria-label="Filtrar el historial">
            {([null, ...(Object.keys(TIPOS_EVENTO) as TipoEvento[])] as (TipoEvento | null)[]).map((t) => {
              const activo = filtro === t;
              return (
                <Link key={t ?? 'todo'} href={consulta({ h: t, ver: null })} scroll={false} aria-current={activo ? 'true' : undefined}
                  className={`tap shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${activo ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-ink-3'}`}>
                  {t ? TIPOS_EVENTO[t] : 'Todo'} <span className={activo ? '' : 'text-ink-3'}>{t ? cuenta[t] : eventos.length}</span>
                </Link>
              );
            })}
          </nav>
          {edita && (motor || u.km != null) && (filtro === null || filtro === 'km') && (
            <details className="group rounded-xl bg-surface-2 px-4 py-3" open={filtro === 'km' && !cuenta.km}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
                <Gauge className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />Registrar el kilometraje de hoy
              </summary>
              <div className="pt-3"><FormularioKm accion={registrarKm.bind(null, org, id)} /></div>
            </details>
          )}
          {visibles.length ? (
            <ol className="flex flex-col">
              {visibles.map((e, i) => <FilaEvento key={e.id} e={e} ultimo={i === visibles.length - 1} />)}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">
              {filtro === 'km' && !motor ? 'Los remolques sin odómetro no llevan kilometraje.' : filtro ? `Sin ${TIPOS_EVENTO[filtro].toLowerCase()} registrados.` : 'Todavía no hay nada registrado para esta unidad.'}
            </p>
          )}
          {!todo && filtrados.length > VISIBLES && (
            <Link href={consulta({ ver: 'todo' })} scroll={false} className="self-start text-sm font-semibold text-accent hover:underline">
              Ver los {filtrados.length} registros
            </Link>
          )}
        </Tarjeta>

        {/* ── Costos ── */}
        <Tarjeta>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">Costos</h2>
            <SelectorPeriodo actual={p} consulta={{ h: filtro ?? undefined }} compacto />
          </div>
          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <Indicador titulo="Total" valor={pesos(costos.total)} detalle={nombrePeriodo} />
            <Indicador
              titulo="Costo por km"
              valor={costos.porKm ? pesos(costos.porKm) : '—'}
              detalle={costos.km > 0 ? `${km(costos.km)} recorridos` : motor ? 'Sin km en el período' : 'Sin odómetro'}
            />
          </div>
          <Ranking
            vacio={`Sin gastos ni trabajos ${nombrePeriodo === 'este mes' ? 'este mes' : 'en el período'}.`}
            filas={costos.desglose.map((s) => ({ clave: s.clave, etiqueta: s.nombre, valor: s.monto, texto: pesos(s.monto), color: s.color }))}
          />
          {costos.consumo != null && <p className="text-sm text-ink-3">Consumo: {numero(costos.consumo, 1)} l cada 100 km ({numero(costos.litros)} l cargados).</p>}
          {puede(empresa, 'gastos.ver') && <Link href={`/empresa/${org}/gastos`} className="self-start text-sm font-semibold text-accent hover:underline">Ver gastos</Link>}
        </Tarjeta>
      </div>

      {/* ── Datos y QR ── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Datos</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {datos.map(([t, v]) => <Dato key={t} titulo={t}>{v}</Dato>)}
          </dl>
        </Tarjeta>

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
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold">QR de la unidad</h2>
              <p className="text-sm text-ink-2">El código QR aparece cuando se ejecuta la migración 0002 en Supabase.</p>
            </>
          )}
        </Tarjeta>
      </div>

      {puede(empresa, 'flota.borrar') && (
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
