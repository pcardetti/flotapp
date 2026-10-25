import { AlertTriangle, CalendarClock, Route, ShieldAlert, Truck, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { SelectorPeriodo } from '@/components/periodo';
import { CostosMensuales, Ranking } from '@/components/graficos';
import { Aviso, BotonLink, Patente, Pildora, Tarjeta } from '@/components/ui';
import { diasHasta, hoyISO } from '@/lib/fechas';
import { PERIODOS, periodoValido, rango } from '@/lib/periodos';
import { km, NOMBRE_CATEGORIA, numero, pesos, pesosCorto, serieDe } from '@/lib/formato';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { nombreSistema } from '@/lib/taller';

type Tablero = {
  totales: { costo: number; km: number; litros: number; combustible: number; mantenimiento: number; viajes: number; fallas: number };
  por_categoria: { categoria: string; monto: number }[];
  por_mes: { mes: string; categorias: Record<string, number> }[];
  por_unidad: { id: string; dominio: string; marca: string; modelo: string; estado: string; km: number; costo: number; litros: number; mantenimiento: number; viajes: number; fallas: number }[];
  por_chofer: { id: string; nombre: string; viajes: number; km: number; gastos: number; litros: number; fallas: number; chequeos: number }[];
  fallas_por_sistema: { sistema: string; cantidad: number }[];
  ahora: { unidades: number; en_servicio: number; en_taller: number; en_viaje: number; fallas_abiertas: number; fallas_criticas: number; vencidos: number; por_vencer: number };
};

const sumarDias = (iso: string, dias: number) => new Date(Date.parse(iso) + dias * 864e5).toISOString().slice(0, 10);

const consumo = (litros: number, kms: number) => (litros > 0 && kms > 0 ? (litros / kms) * 100 : null);

function Indicador({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-2xl border bg-surface px-4 py-3.5 ${alerta ? 'border-crit' : 'border-line'}`}>
      <span className="eyebrow">{titulo}</span>
      <span className="truncate font-display text-[2rem] font-bold leading-none">{valor}</span>
      {detalle && <span className="text-sm text-ink-3">{detalle}</span>}
    </div>
  );
}

// Singular o plural según la cantidad: "1 falla abierta", "3 fallas abiertas".
const pl = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export async function TableroFlota({ org, periodo }: { org: string; periodo: string }) {
  const p = periodoValido(periodo);
  const { desde, hasta } = rango(p, hoyISO());
  const supabase = await crearClienteServidor();
  const [{ data, error }, { data: docs }] = await Promise.all([
    supabase.rpc('tablero', { p_org: org, p_desde: desde, p_hasta: hasta }),
    supabase.from('documentos').select('id, vence, tipo:tipos_documento(nombre), unidad:unidades(dominio), chofer:choferes(nombre)')
      .eq('organizacion_id', org).lte('vence', sumarDias(hoyISO(), 30)).order('vence').limit(6),
  ]);
  avisarError('tablero', error);
  type Uno<T> = T | T[] | null;
  const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;
  const proximos = (docs ?? []).map((d) => ({
    id: d.id as string,
    vence: d.vence as string,
    tipo: uno(d.tipo as Uno<{ nombre: string }>)?.nombre ?? 'Documento',
    dueno: uno(d.unidad as Uno<{ dominio: string }>)?.dominio ?? uno(d.chofer as Uno<{ nombre: string }>)?.nombre ?? '',
  }));

  const selector = <SelectorPeriodo actual={p} />;

  if (error || !data) {
    return (
      <>
        <Encabezado titulo="Tablero">{selector}</Encabezado>
        <Aviso tipo="error">
          {error?.code === 'PGRST202'
            ? 'Falta actualizar la base de datos: ejecutá la migración 0002 en el SQL Editor de Supabase para ver el tablero.'
            : 'No pudimos cargar el tablero. Probá de nuevo en unos segundos.'}
        </Aviso>
      </>
    );
  }

  const t = data as Tablero;
  const { totales: tot, ahora } = t;
  const costoKm = tot.km > 0 ? tot.costo / tot.km : null;
  const l100 = consumo(tot.litros, tot.km);
  const unidades = t.por_unidad.map((u) => ({ ...u, costoKm: u.km > 0 ? u.costo / u.km : null, l100: consumo(Number(u.litros), Number(u.km)) }));
  const masCara = unidades.filter((u) => u.costoKm !== null).sort((a, b) => (b.costoKm ?? 0) - (a.costoKm ?? 0))[0];

  if (!ahora.unidades) {
    return (
      <>
        <Encabezado titulo="Tablero" />
        <Tarjeta>
          <h2 className="font-display text-2xl font-bold">Arranquemos</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink-2">
            <li><Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/flota/unidades/nueva`}>Cargá tus unidades</Link> y choferes.</li>
            <li>Imprimí el QR de cada unidad y pegalo en la cabina.</li>
            <li><Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/equipo`}>Invitá a tus choferes y mecánicos</Link> por WhatsApp.</li>
          </ol>
          <p className="text-sm text-ink-3">Con el primer viaje y el primer gasto, este tablero empieza a mostrar costos por unidad y por chofer.</p>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Tablero">{selector}</Encabezado>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Indicador titulo="Costo operativo" valor={pesosCorto(tot.costo)} detalle={`Mantenimiento ${pesosCorto(tot.mantenimiento)}`} />
        <Indicador titulo="Costo por km" valor={costoKm !== null ? `$ ${numero(costoKm, costoKm < 100 ? 1 : 0)}` : '—'} detalle={costoKm === null ? 'Faltan km registrados' : 'Total ÷ km recorridos'} />
        <Indicador titulo="Km recorridos" valor={numero(tot.km)} detalle={`${tot.viajes} ${tot.viajes === 1 ? 'viaje' : 'viajes'}`} />
        <Indicador titulo="Consumo" valor={l100 !== null ? `${numero(l100, 1)} l` : '—'} detalle={l100 !== null ? 'cada 100 km' : 'Cargá litros con el combustible'} />
        <Indicador titulo="Combustible" valor={pesosCorto(tot.combustible)} detalle={tot.litros > 0 ? `$ ${numero(tot.combustible / tot.litros)} por litro` : 'Sin cargas en el período'} />
        <Indicador titulo="Fallas reportadas" valor={String(tot.fallas)} detalle="en el período" alerta={ahora.fallas_criticas > 0} />
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { href: 'viajes', icono: <Route className="size-5" />, valor: ahora.en_viaje, texto: 'en viaje ahora' },
          { href: 'flota', icono: <Truck className="size-5" />, valor: `${ahora.en_servicio}/${ahora.unidades}`, texto: 'unidades en servicio' },
          { href: 'taller', icono: ahora.fallas_criticas ? <ShieldAlert className="size-5 text-crit" /> : <Wrench className="size-5" />, valor: ahora.fallas_abiertas, texto: `${pl(ahora.fallas_abiertas, 'falla abierta', 'fallas abiertas')}${ahora.fallas_criticas ? ` (${ahora.fallas_criticas} ${pl(ahora.fallas_criticas, 'crítica', 'críticas')})` : ''}`, alerta: ahora.fallas_criticas > 0 },
          { href: 'vencimientos', icono: ahora.vencidos ? <AlertTriangle className="size-5 text-crit" /> : <CalendarClock className="size-5" />, valor: ahora.vencidos + ahora.por_vencer, texto: ahora.vencidos ? `${pl(ahora.vencidos + ahora.por_vencer, 'vencimiento', 'vencimientos')} (${ahora.vencidos} ${pl(ahora.vencidos, 'vencido', 'vencidos')})` : pl(ahora.por_vencer, 'vence en 30 días', 'vencen en 30 días'), alerta: ahora.vencidos > 0 },
        ].map((x) => (
          <Link key={x.href} href={`/empresa/${org}/${x.href}`} transitionTypes={['nav-forward']}
            className={`tap flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3 hover:border-ink-3 ${x.alerta ? 'border-crit' : 'border-line'}`}>
            <span className="text-ink-2">{x.icono}</span>
            <span className="min-w-0"><b className="block font-display text-2xl leading-none">{x.valor}</b><span className="text-xs text-ink-3">{x.texto}</span></span>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Tarjeta>
          <div className="flex items-baseline justify-between gap-3"><h2 className="font-display text-xl font-bold">Costos por mes</h2><span className="text-sm text-ink-3">Últimos 12 meses</span></div>
          <CostosMensuales meses={t.por_mes} />
        </Tarjeta>
        <Tarjeta>
          <div className="flex items-baseline justify-between gap-3"><h2 className="font-display text-xl font-bold">En qué se gasta</h2><span className="text-sm text-ink-3">{PERIODOS.find((x) => x.clave === p)?.texto}</span></div>
          <Ranking
            vacio="Sin gastos en el período."
            filas={t.por_categoria.map((c) => ({
              clave: c.categoria, valor: Number(c.monto), color: serieDe(c.categoria).color,
              etiqueta: NOMBRE_CATEGORIA[c.categoria] ?? c.categoria,
              texto: `${pesosCorto(Number(c.monto))} · ${tot.costo ? Math.round((Number(c.monto) / tot.costo) * 100) : 0}%`,
            }))}
          />
        </Tarjeta>
      </div>

      <Tarjeta>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Por unidad</h2>
          {masCara && unidades.length > 1 && <span className="text-sm text-ink-3">La más cara por km: <b className="text-ink">{masCara.dominio}</b> ($ {numero(masCara.costoKm ?? 0)}/km)</span>}
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                <th className="py-2 pr-3 font-semibold">Unidad</th>
                <th className="py-2 pr-3 text-right font-semibold">Km</th>
                <th className="py-2 pr-3 text-right font-semibold">Costo</th>
                <th className="py-2 pr-3 text-right font-semibold">$/km</th>
                <th className="py-2 pr-3 text-right font-semibold">l/100 km</th>
                <th className="py-2 pr-3 text-right font-semibold">Viajes</th>
                <th className="py-2 pr-3 text-right font-semibold">Fallas</th>
                <th className="py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="py-2.5 pr-3">
                    <Link href={`/empresa/${org}/flota/unidades/${u.id}`} transitionTypes={['nav-forward']} className="flex items-center gap-2.5 hover:underline">
                      <Patente dominio={u.dominio} /><span className="hidden truncate text-ink-2 md:inline">{u.marca} {u.modelo}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{numero(Number(u.km))}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{pesos(Number(u.costo))}</td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums ${u.id === masCara?.id && unidades.length > 1 ? 'font-bold text-crit' : ''}`}>{u.costoKm !== null ? `$ ${numero(u.costoKm, u.costoKm < 100 ? 1 : 0)}` : '—'}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{u.l100 !== null ? numero(u.l100, 1) : '—'}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{u.viajes}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{u.fallas}</td>
                  <td className="py-2.5"><Pildora tipo={u.estado === 'operativa' ? 'ok' : u.estado === 'taller' ? 'warn' : 'neutro'}>{u.estado === 'operativa' ? 'En servicio' : u.estado === 'taller' ? 'En taller' : 'De baja'}</Pildora></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-display text-xl font-bold">Por chofer</h2>
        {t.por_chofer.length ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="py-2 pr-3 font-semibold">Chofer</th>
                  <th className="py-2 pr-3 text-right font-semibold">Viajes</th>
                  <th className="py-2 pr-3 text-right font-semibold">Km</th>
                  <th className="py-2 pr-3 text-right font-semibold">Gastos</th>
                  <th className="py-2 pr-3 text-right font-semibold">l/100 km</th>
                  <th className="py-2 pr-3 text-right font-semibold">Chequeos</th>
                  <th className="py-2 text-right font-semibold">Fallas</th>
                </tr>
              </thead>
              <tbody>
                {t.por_chofer.map((c) => {
                  const l = consumo(Number(c.litros), Number(c.km));
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 font-semibold">{c.nombre}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.viajes}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{km(Number(c.km))}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{pesos(Number(c.gastos))}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{l !== null ? numero(l, 1) : '—'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.chequeos}</td>
                      <td className="py-2.5 text-right tabular-nums">{c.fallas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-3">Cargá choferes en Flota y choferes para ver sus viajes y gastos.</p>
        )}
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Fallas más frecuentes</h2>
          <Ranking
            vacio="Sin fallas en el período."
            filas={t.fallas_por_sistema.slice(0, 8).map((f) => ({ clave: f.sistema, etiqueta: nombreSistema(f.sistema), valor: f.cantidad, texto: String(f.cantidad), color: 'var(--ink-3)' }))}
          />
          <BotonLink href={`/empresa/${org}/taller`} variante="secundario">Ver taller</BotonLink>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Próximos vencimientos</h2>
          {proximos.length ? (
            <ul className="flex flex-col">
              {proximos.map((d) => {
                const dias = diasHasta(d.vence);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                    <span className="min-w-0">
                      <b className="block truncate">{d.tipo}</b>
                      <span className="text-sm text-ink-3">{d.dueno}</span>
                    </span>
                    <Pildora tipo={dias < 0 ? 'crit' : 'warn'}>{dias < 0 ? `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}` : dias === 0 ? 'Vence hoy' : `En ${dias} ${dias === 1 ? 'día' : 'días'}`}</Pildora>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Nada vence en los próximos 30 días.</p>
          )}
          <BotonLink href={`/empresa/${org}/vencimientos`} variante="secundario">Ver vencimientos</BotonLink>
        </Tarjeta>
      </div>
      <p className="text-xs text-ink-3">Del {desde.split('-').reverse().join('/')} al {hasta.split('-').reverse().join('/')}. Los costos incluyen gastos cargados y trabajos del taller con importe. Los km salen de las lecturas de kilometraje.</p>
    </>
  );
}
