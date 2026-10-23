import type { Rol, TipoOrganizacion } from './empresa';

export type Seccion = {
  ruta: string;
  titulo: string;
  tipos: TipoOrganizacion[];
  roles?: Rol[]; // sin roles: cualquier miembro
};

const GESTION: Rol[] = ['admin', 'jefe_taller', 'lectura'];

// Qué secciones ve cada tipo de empresa y cada rol en la app de gestión. Choferes y mecánicos
// usan sus propias apps. El permiso real lo controla la base; esto arma el menú.
export const SECCIONES: Seccion[] = [
  { ruta: 'panel', titulo: 'Tablero', tipos: ['flota'], roles: GESTION },
  { ruta: 'panel', titulo: 'Panel', tipos: ['taller', 'recapadora'] },
  { ruta: 'flota', titulo: 'Flota y choferes', tipos: ['flota'], roles: GESTION },
  { ruta: 'viajes', titulo: 'Viajes', tipos: ['flota'], roles: GESTION },
  { ruta: 'taller', titulo: 'Taller', tipos: ['flota'], roles: GESTION },
  { ruta: 'gastos', titulo: 'Gastos', tipos: ['flota'], roles: GESTION },
  { ruta: 'vencimientos', titulo: 'Vencimientos', tipos: ['flota'], roles: GESTION },
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
