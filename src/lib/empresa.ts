import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';
import { puedeVer } from '@/lib/navegacion';

export type TipoOrganizacion = 'flota' | 'taller' | 'recapadora';
export type Rol = 'admin' | 'jefe_taller' | 'mecanico' | 'chofer' | 'lectura' | 'operario';

export type Organizacion = { id: string; nombre: string; tipo: TipoOrganizacion };
export type Membresia = { rol: Rol; organizacion: Organizacion };

export const NOMBRE_TIPO: Record<TipoOrganizacion, string> = {
  flota: 'Flota de transporte',
  taller: 'Taller',
  recapadora: 'Recapadora',
};

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  jefe_taller: 'Jefe de taller',
  mecanico: 'Mecánico',
  chofer: 'Chofer',
  lectura: 'Consulta',
  operario: 'Operario',
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esGestor = (rol: Rol) => rol === 'admin' || rol === 'jefe_taller';

export const misEmpresas = cache(async (): Promise<Membresia[]> => {
  const usuario = await usuarioActual();
  if (!usuario) return [];
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('miembros')
    .select('rol, organizacion:organizaciones(id, nombre, tipo)')
    .eq('user_id', usuario.id)
    .order('creado_en');
  avisarError('misEmpresas', error);
  return (data ?? []).flatMap((m) => {
    const org = Array.isArray(m.organizacion) ? m.organizacion[0] : m.organizacion;
    return org ? [{ rol: m.rol as Rol, organizacion: org as Organizacion }] : [];
  });
});

// Empresa abierta en la URL. Si el usuario no pertenece a ella, la página no existe para él.
export const empresaActual = cache(async (orgId: string) => {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar');
  if (!UUID.test(orgId)) notFound();
  const membresia = (await misEmpresas()).find((m) => m.organizacion.id === orgId);
  if (!membresia) notFound();
  return { usuario, ...membresia };
});

// Igual que empresaActual, pero además exige que el rol pueda ver esa sección.
export async function abrirSeccion(orgId: string, ruta: string) {
  const empresa = await empresaActual(orgId);
  if (!puedeVer(ruta, empresa.organizacion.tipo, empresa.rol)) notFound();
  return empresa;
}
