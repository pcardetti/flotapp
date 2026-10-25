// Planes de Tallerflota: un precio fijo por período según cuántas unidades tiene la flota, y todos incluyen todo.
// La lista vive en la base (tabla planes, migración 0006): ahí se cambian los precios y de ahí salen la página de
// venta, el tope de unidades y los cobros. Pesos argentinos sin IVA; el anual equivale a 10 meses.

export type Periodo = 'mensual' | 'anual';

export type Plan = {
  clave: string;
  nombre: string;
  max_unidades: number | null; // null: sin tope
  precio_mensual: number | null; // null: a cotizar
  precio_anual: number | null;
  bajada: string;
};

// Lo que trae cualquier plan: cambia sólo cuántas unidades se pueden tener en servicio.
export const INCLUYE = [
  'Las tres apps: gestión, Chofer y Taller',
  'Usuarios sin límite',
  'QR por unidad y chequeo de salida',
  'Fallas, trabajos y gastos con fotos',
  'Vencimientos y tablero de costos',
  'Permisos por rol y registro de actividad',
];

export const DIAS_DE_PRUEBA = 14;
export const MAX_UNIDADES = 5000;

// El plan que corresponde a una cantidad de unidades: el más chico que alcanza.
export const planPara = (planes: Plan[], unidades: number) =>
  planes.find((p) => p.max_unidades === null || unidades <= p.max_unidades) ?? planes[planes.length - 1];

// Desde cuántas unidades rige cada plan (una más que el tope del anterior).
export function desde(planes: Plan[], plan: Plan) {
  const i = planes.findIndex((p) => p.clave === plan.clave);
  return i <= 0 ? 1 : (planes[i - 1].max_unidades ?? 0) + 1;
}

export const precioDe = (plan: Plan, periodo: Periodo) => (periodo === 'anual' ? plan.precio_anual : plan.precio_mensual);
export const seCotiza = (plan: Plan) => plan.precio_mensual === null;
