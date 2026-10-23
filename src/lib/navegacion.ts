import type { Rol, TipoOrganizacion } from './empresa';

export type Seccion = {
  ruta: string;
  titulo: string;
  tipos: TipoOrganizacion[];
  roles?: Rol[]; // sin roles: cualquier miembro
};

const GESTION: Rol[] = ['admin', 'jefe_taller', 'lectura'];

// Qué secciones ve cada tipo de empresa y cada rol. El permiso real lo controla la base;
// esto sólo arma el menú y evita mostrar pantallas que quedarían vacías.
export const SECCIONES: Seccion[] = [
  { ruta: 'panel', titulo: 'Panel', tipos: ['flota', 'taller', 'recapadora'] },
  { ruta: 'flota', titulo: 'Flota y choferes', tipos: ['flota'], roles: GESTION },
  { ruta: 'mantenimiento', titulo: 'Plan de mantenimiento', tipos: ['flota'], roles: GESTION },
  { ruta: 'ordenes', titulo: 'Órdenes de trabajo', tipos: ['flota'], roles: GESTION },
  { ruta: 'vencimientos', titulo: 'Vencimientos', tipos: ['flota'], roles: GESTION },
  { ruta: 'neumaticos', titulo: 'Neumáticos', tipos: ['flota'], roles: GESTION },
  { ruta: 'control-diario', titulo: 'Control diario', tipos: ['flota'], roles: ['admin', 'jefe_taller', 'chofer'] },
  { ruta: 'trabajos', titulo: 'Trabajos asignados', tipos: ['taller'] },
  { ruta: 'recapados', titulo: 'Neumáticos recibidos', tipos: ['recapadora'] },
  { ruta: 'proveedores', titulo: 'Talleres y recapadoras', tipos: ['flota'], roles: ['admin', 'jefe_taller'] },
  { ruta: 'clientes', titulo: 'Flotas clientes', tipos: ['taller', 'recapadora'] },
  { ruta: 'equipo', titulo: 'Equipo', tipos: ['flota', 'taller', 'recapadora'], roles: ['admin'] },
  { ruta: 'ajustes', titulo: 'Ajustes', tipos: ['flota'], roles: ['admin'] },
];

export const seccionesPara = (tipo: TipoOrganizacion, rol: Rol) =>
  SECCIONES.filter((s) => s.tipos.includes(tipo) && (!s.roles || s.roles.includes(rol)));

export const puedeVer = (ruta: string, tipo: TipoOrganizacion, rol: Rol) =>
  seccionesPara(tipo, rol).some((s) => s.ruta === ruta);
