import { puede, type Permiso, type Quien, type TipoOrganizacion } from './permisos';

export type Seccion = {
  ruta: string;
  titulo: string;
  tipos: TipoOrganizacion[];
  permiso?: Permiso; // sin permiso: cualquier miembro
};

// Qué secciones tiene cada tipo de empresa en la app de gestión y qué permiso pide cada una (src/lib/permisos).
// Choferes y mecánicos usan sus propias apps.
export const SECCIONES: Seccion[] = [
  { ruta: 'panel', titulo: 'Tablero', tipos: ['flota'], permiso: 'tablero.ver' },
  { ruta: 'panel', titulo: 'Panel', tipos: ['taller', 'recapadora'] },
  { ruta: 'flota', titulo: 'Flota y choferes', tipos: ['flota'], permiso: 'flota.ver' },
  { ruta: 'viajes', titulo: 'Viajes', tipos: ['flota'], permiso: 'viajes.ver' },
  { ruta: 'taller', titulo: 'Taller', tipos: ['flota'], permiso: 'taller.ver' },
  { ruta: 'gastos', titulo: 'Gastos', tipos: ['flota'], permiso: 'gastos.ver' },
  { ruta: 'vencimientos', titulo: 'Vencimientos', tipos: ['flota'], permiso: 'vencimientos.ver' },
  { ruta: 'trabajos', titulo: 'Trabajos asignados', tipos: ['taller'] },
  { ruta: 'recapados', titulo: 'Neumáticos recibidos', tipos: ['recapadora'] },
  { ruta: 'proveedores', titulo: 'Talleres y recapadoras', tipos: ['flota'], permiso: 'proveedores.ver' },
  { ruta: 'clientes', titulo: 'Flotas clientes', tipos: ['taller', 'recapadora'] },
  { ruta: 'equipo', titulo: 'Equipo', tipos: ['flota', 'taller', 'recapadora'], permiso: 'equipo.administrar' },
  { ruta: 'actividad', titulo: 'Actividad', tipos: ['flota', 'taller', 'recapadora'], permiso: 'actividad.ver' },
  { ruta: 'ajustes', titulo: 'Ajustes', tipos: ['flota'], permiso: 'ajustes.editar' },
  { ruta: 'suscripcion', titulo: 'Suscripción', tipos: ['flota'], permiso: 'suscripcion.administrar' },
];

// La sección con esa ruta en este tipo de empresa (si no existe, la página es un 404).
export const seccionDe = (ruta: string, tipo: TipoOrganizacion) => SECCIONES.find((s) => s.ruta === ruta && s.tipos.includes(tipo));

export const seccionesPara = (quien: Quien) =>
  SECCIONES.filter((s) => s.tipos.includes(quien.organizacion.tipo) && (!s.permiso || puede(quien, s.permiso)));
