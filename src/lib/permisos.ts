// Quién puede qué, en un solo lugar: el menú, las pantallas y las acciones del servidor preguntan acá.
// La base controla lo mismo con sus políticas; `npm run test:db` comprueba rol por rol que coincidan.
// Este archivo no importa nada: lo usan también las pruebas y el modo demo.

export const ROLES = ['admin', 'jefe_taller', 'mecanico', 'chofer', 'lectura', 'operario'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS = ['flota', 'taller', 'recapadora'] as const;
export type TipoOrganizacion = (typeof TIPOS)[number];

// Roles que se pueden dar en cada tipo de empresa, en el orden en que se ofrecen.
export const ROLES_DE: Record<TipoOrganizacion, readonly Rol[]> = {
  flota: ['admin', 'jefe_taller', 'mecanico', 'chofer', 'lectura'],
  taller: ['admin', 'operario'],
  recapadora: ['admin', 'operario'],
};

// Cada grupo es el mismo conjunto de roles que usa la base (a la derecha, su función o regla).
export const GRUPOS = {
  admin: ['admin'], // es_miembro(org, array['admin'])
  gestion: ['admin', 'jefe_taller'], // es_gestor: cargan y corrigen los datos de la flota
  gerencia: ['admin', 'jefe_taller', 'lectura'], // es_gerencia: ven tablero, viajes y gastos de todos
  taller: ['admin', 'jefe_taller', 'mecanico'], // es_mecanico: resuelven fallas y registran trabajos
  conduccion: ['admin', 'jefe_taller', 'chofer'], // iniciar_viaje: pueden salir con una unidad
} as const satisfies Record<string, readonly Rol[]>;
export type Grupo = keyof typeof GRUPOS;

type Regla = { grupo: Grupo; que: string; tipos?: readonly TipoOrganizacion[] };

const TODAS = TIPOS;

// `que` completa "No podés…" en la pantalla Sin acceso y "Intentó… sin permiso" en Actividad.
// Sin `tipos`, el permiso existe sólo en las flotas.
export const PERMISOS = {
  'tablero.ver': { grupo: 'gerencia', que: 'ver el tablero' },
  'flota.ver': { grupo: 'gerencia', que: 'ver la flota y los choferes' },
  'flota.editar': { grupo: 'gestion', que: 'cargar o editar unidades y choferes' },
  'flota.borrar': { grupo: 'admin', que: 'eliminar unidades' },
  'viajes.ver': { grupo: 'gerencia', que: 'ver los viajes' },
  'taller.ver': { grupo: 'gerencia', que: 'ver el taller' },
  'taller.operar': { grupo: 'taller', que: 'registrar trabajos o cerrar órdenes' },
  'gastos.ver': { grupo: 'gerencia', que: 'ver los gastos' },
  'gastos.editar': { grupo: 'gestion', que: 'cargar o borrar gastos' },
  'vencimientos.ver': { grupo: 'gerencia', que: 'ver los vencimientos' },
  'vencimientos.editar': { grupo: 'gestion', que: 'cargar o renovar documentos' },
  'proveedores.ver': { grupo: 'gestion', que: 'ver los talleres y recapadoras' },
  'qr.imprimir': { grupo: 'gerencia', que: 'imprimir los QR' },
  'equipo.administrar': { grupo: 'admin', que: 'administrar el equipo', tipos: TODAS },
  'actividad.ver': { grupo: 'admin', que: 'ver la actividad', tipos: TODAS },
  'ajustes.editar': { grupo: 'admin', que: 'cambiar los ajustes' },
  'app.chofer': { grupo: 'conduccion', que: 'usar la app Chofer' },
  'app.taller': { grupo: 'taller', que: 'usar la app Taller' },
} as const satisfies Record<string, Regla>;
export type Permiso = keyof typeof PERMISOS;

export type Quien = { rol: Rol; organizacion: { tipo: TipoOrganizacion } };

export const enGrupo = (grupo: Grupo, rol: string) => (GRUPOS[grupo] as readonly string[]).includes(rol);

export function puede({ rol, organizacion }: Quien, permiso: Permiso) {
  const regla: Regla = PERMISOS[permiso];
  return (regla.tipos ?? ['flota']).includes(organizacion.tipo) && enGrupo(regla.grupo, rol);
}

export const esPermiso = (valor: unknown): valor is Permiso => typeof valor === 'string' && Object.hasOwn(PERMISOS, valor);
