// Planes de Flotapp: un precio fijo por mes según cuántas unidades tiene la flota, y todos incluyen todo.
// Los precios se cambian sólo acá: la página de inicio, el calculador, el pedido de contratación y los datos para
// buscadores salen de esta lista. Pesos argentinos por mes, sin IVA.

export type Plan = {
  clave: string;
  nombre: string;
  hasta: number | null; // unidades como máximo; null: sin tope (precio a medida)
  precio: number | null; // null: se cotiza
  bajada: string;
};

export const PLANES: Plan[] = [
  { clave: 'inicial', nombre: 'Inicial', hasta: 5, precio: 49000, bajada: 'Para ordenar una flota chica desde el primer día.' },
  { clave: 'flota', nombre: 'Flota', hasta: 15, precio: 119000, bajada: 'Para flotas que crecen y suman choferes y mecánicos.' },
  { clave: 'empresa', nombre: 'Empresa', hasta: 40, precio: 259000, bajada: 'Para operaciones grandes, con taller propio.' },
  { clave: 'a-medida', nombre: 'A medida', hasta: null, precio: null, bajada: 'Más de 40 unidades: armamos un precio para tu operación.' },
];

// Lo que trae cualquier plan: cambia sólo cuántas unidades se pueden cargar.
export const INCLUYE = [
  'Las tres apps: gestión, Chofer y Taller',
  'Usuarios sin límite',
  'QR por unidad y chequeo de salida',
  'Fallas, trabajos y gastos con fotos',
  'Vencimientos y tablero de costos',
  'Permisos por rol y registro de actividad',
];

export const MAX_UNIDADES = 5000;

// El plan que corresponde a una cantidad de unidades: el más chico que alcanza.
export function planPara(unidades: number): Plan {
  return PLANES.find((p) => p.hasta === null || unidades <= p.hasta) ?? PLANES[PLANES.length - 1];
}

// Unidades del plan anterior + 1: desde cuántas unidades rige cada plan.
export function desde(plan: Plan) {
  const i = PLANES.indexOf(plan);
  return i <= 0 ? 1 : (PLANES[i - 1].hasta ?? 0) + 1;
}
