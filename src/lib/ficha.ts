// Historia y costos de una unidad: arma la línea de tiempo y las cuentas de la ficha. Sin dependencias de Next ni de
// Supabase, para poder probarlo solo.
import { SERIES_COSTO } from './formato.ts';
import { GRAVEDAD, nombreSistema } from './taller.ts';

type Tono = 'neutro' | 'ok' | 'warn' | 'crit' | 'info';

export const TIPOS_EVENTO = {
  falla: 'Fallas',
  trabajo: 'Trabajos',
  orden: 'Órdenes',
  viaje: 'Viajes',
  km: 'Kilometraje',
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;
export const esTipoEvento = (t: unknown): t is TipoEvento => typeof t === 'string' && Object.hasOwn(TIPOS_EVENTO, t);

export type Evento = {
  id: string;
  tipo: TipoEvento;
  // Momento para ordenar (ISO). Las fechas sin hora se toman al mediodía argentino.
  momento: string;
  // true si el dato original es sólo un día, sin hora.
  soloDia: boolean;
  titulo: string;
  detalle?: string | null;
  // Etiquetas a la derecha: gravedad, estado, tipo de trabajo.
  pildoras: { texto: string; tono: Tono }[];
  monto?: number;
};

export type FallaFila = { id: string; sistema: string; descripcion: string | null; gravedad: string; estado: string; creada_en: string; chofer?: string | null };
export type OrdenFila = {
  id: string; numero: number; tipo: string; descripcion: string; trabajo: string | null; estado: string;
  fecha_ingreso: string; fecha_egreso: string | null; repuestos: number | string | null; mano_obra: number | string | null;
};
export type ViajeFila = { id: string; estado: string; inicio: string; fin: string | null; km_inicio: number | null; km_fin: number | null; destino: string | null; chofer?: string | null };
export type LecturaFila = { id: string; km: number; fecha: string; origen: string; creado_en?: string | null };
export type GastoFila = { categoria: string; monto: number | string; litros: number | string | null; fecha: string };

const mediodia = (dia: string) => `${dia}T15:00:00.000Z`;
const costoOrden = (o: OrdenFila) => Number(o.repuestos ?? 0) + Number(o.mano_obra ?? 0);
const miles = (n: number) => n.toLocaleString('es-AR');

const ESTADO_FALLA: Record<string, { texto: string; tono: Tono }> = {
  abierta: { texto: 'Abierta', tono: 'crit' },
  en_reparacion: { texto: 'En reparación', tono: 'info' },
  resuelta: { texto: 'Resuelta', tono: 'ok' },
  descartada: { texto: 'Descartada', tono: 'neutro' },
};

export const ORIGEN_LECTURA: Record<string, string> = {
  alta: 'Alta de la unidad', manual: 'Carga manual', edicion: 'Edición', correccion: 'Corrección',
  chequeo: 'Chequeo de salida', viaje: 'Fin de viaje', taller: 'Taller',
};

// Una orden que se abrió y se cerró el mismo día es un trabajo registrado de una vez; si estuvo abierta, es una orden.
export const esTrabajo = (o: OrdenFila) => o.estado === 'cerrada' && o.fecha_egreso === o.fecha_ingreso;

// Todo lo que le pasó a la unidad, lo más reciente primero.
export function lineaDeTiempo({ fallas = [], ordenes = [], viajes = [], lecturas = [] }: { fallas?: FallaFila[]; ordenes?: OrdenFila[]; viajes?: ViajeFila[]; lecturas?: LecturaFila[] }): Evento[] {
  const eventos: Evento[] = [
    ...fallas.map((f): Evento => {
      const g = GRAVEDAD[f.gravedad as keyof typeof GRAVEDAD];
      const detalle = f.descripcion && f.descripcion !== nombreSistema(f.sistema) ? f.descripcion : null;
      return {
        id: `falla-${f.id}`, tipo: 'falla', momento: f.creada_en, soloDia: false,
        titulo: `Falla: ${nombreSistema(f.sistema)}`,
        detalle: [detalle, f.chofer ? `Avisó ${f.chofer}` : null].filter(Boolean).join(' · ') || null,
        pildoras: [...(g && f.estado !== 'resuelta' && f.estado !== 'descartada' ? [{ texto: g.texto, tono: g.tono }] : []), ESTADO_FALLA[f.estado] ?? { texto: f.estado, tono: 'neutro' }],
      };
    }),
    ...ordenes.map((o): Evento => {
      const trabajo = esTrabajo(o);
      const cerrada = o.estado === 'cerrada';
      const costo = costoOrden(o);
      return {
        id: `orden-${o.id}`, tipo: trabajo ? 'trabajo' : 'orden', momento: mediodia(cerrada && o.fecha_egreso ? o.fecha_egreso : o.fecha_ingreso), soloDia: true,
        titulo: `${trabajo ? '' : `Orden #${o.numero} · `}${o.descripcion}`,
        detalle: o.trabajo ?? (trabajo ? null : cerrada ? null : 'En el taller'),
        pildoras: [
          { texto: o.tipo === 'preventivo' ? 'Mantenimiento' : 'Reparación', tono: o.tipo === 'preventivo' ? 'info' : 'neutro' },
          ...(trabajo ? [] : [cerrada ? { texto: 'Cerrada', tono: 'ok' as const } : { texto: 'Abierta', tono: 'warn' as const }]),
        ],
        monto: cerrada && costo > 0 ? costo : undefined,
      };
    }),
    ...viajes.map((v): Evento => {
      const recorrido = v.km_fin != null && v.km_inicio != null ? v.km_fin - v.km_inicio : null;
      return {
        id: `viaje-${v.id}`, tipo: 'viaje', momento: v.inicio, soloDia: false,
        titulo: v.destino ? `Viaje a ${v.destino}` : 'Viaje',
        detalle: [v.chofer, recorrido != null ? `${miles(recorrido)} km` : null].filter(Boolean).join(' · ') || null,
        pildoras: v.estado === 'en_curso' ? [{ texto: 'En curso', tono: 'info' }] : [],
      };
    }),
    ...lecturas.map((l): Evento => ({
      id: `km-${l.id}`, tipo: 'km', momento: l.creado_en ?? mediodia(l.fecha), soloDia: !l.creado_en,
      titulo: `${miles(l.km)} km`, detalle: ORIGEN_LECTURA[l.origen] ?? l.origen, pildoras: [],
    })),
  ];
  return eventos.sort((a, b) => (a.momento < b.momento ? 1 : a.momento > b.momento ? -1 : 0));
}

export const contarPorTipo = (eventos: Evento[]) =>
  Object.fromEntries((Object.keys(TIPOS_EVENTO) as TipoEvento[]).map((t) => [t, eventos.filter((e) => e.tipo === t).length])) as Record<TipoEvento, number>;

// Kilómetros recorridos en el período, con la misma cuenta que el tablero: la lectura más alta hasta el final menos
// la más alta antes del comienzo (o la más baja del período, si la unidad empezó a medirse adentro).
export function kmDelPeriodo(lecturas: Pick<LecturaFila, 'km' | 'fecha'>[], desde: string, hasta: string) {
  const hastaFin = lecturas.filter((l) => l.fecha <= hasta).map((l) => l.km);
  if (!hastaFin.length) return 0;
  const antes = lecturas.filter((l) => l.fecha < desde).map((l) => l.km);
  const adentro = lecturas.filter((l) => l.fecha >= desde && l.fecha <= hasta).map((l) => l.km);
  const inicio = antes.length ? Math.max(...antes) : adentro.length ? Math.min(...adentro) : Math.max(...hastaFin);
  return Math.max(0, Math.max(...hastaFin) - inicio);
}

// Costos de la unidad en el período: los gastos cargados más el mantenimiento de las órdenes cerradas.
export function costosDelPeriodo({ gastos, ordenes, lecturas, desde, hasta }: { gastos: GastoFila[]; ordenes: OrdenFila[]; lecturas: Pick<LecturaFila, 'km' | 'fecha'>[]; desde: string; hasta: string }) {
  const montos = new Map<string, number>(SERIES_COSTO.map((s) => [s.clave, 0]));
  let litros = 0;
  for (const g of gastos) {
    if (g.fecha < desde || g.fecha > hasta) continue;
    const serie = SERIES_COSTO.find((s) => (s.categorias as readonly string[]).includes(g.categoria)) ?? SERIES_COSTO[5];
    montos.set(serie.clave, montos.get(serie.clave)! + Number(g.monto));
    if (g.categoria === 'combustible') litros += Number(g.litros ?? 0);
  }
  for (const o of ordenes) {
    if (o.estado !== 'cerrada' || !o.fecha_egreso || o.fecha_egreso < desde || o.fecha_egreso > hasta) continue;
    montos.set('mantenimiento', montos.get('mantenimiento')! + costoOrden(o));
  }
  const total = [...montos.values()].reduce((a, b) => a + b, 0);
  const km = kmDelPeriodo(lecturas, desde, hasta);
  // Combustible, mantenimiento y neumáticos siempre; el resto, sólo si hubo gastos.
  const desglose = SERIES_COSTO.map((s) => ({ clave: s.clave, nombre: s.nombre, color: s.color, monto: montos.get(s.clave)! }))
    .filter((s) => ['combustible', 'mantenimiento', 'neumaticos'].includes(s.clave) || s.monto > 0);
  return { total, km, porKm: km > 0 ? total / km : null, litros, consumo: km > 0 && litros > 0 ? (litros / km) * 100 : null, desglose };
}

// Estado de un documento según los días que faltan y el aviso de su tipo.
export const estadoVencimiento = (dias: number, avisoDias = 30) => (dias < 0 ? 'vencido' : dias <= avisoDias ? 'proximo' : 'ok');
