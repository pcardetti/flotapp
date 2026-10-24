import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';
import { seccionDe } from '@/lib/navegacion';
import { puede, type Permiso, type Rol, type TipoOrganizacion } from '@/lib/permisos';

export type { Rol, TipoOrganizacion };

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

// Igual que empresaActual, pero además exige que el rol pueda ver esa sección y, si se pide, otro permiso
// (por ejemplo, editar). Una sección que este tipo de empresa no tiene da 404. Si existe pero el rol no
// alcanza, queda anotado en la actividad y la persona ve qué no puede hacer y a quién pedírselo.
export async function abrirSeccion(orgId: string, ruta: string, permiso?: Permiso) {
  const empresa = await empresaActual(orgId);
  const seccion = seccionDe(ruta, empresa.organizacion.tipo);
  if (!seccion) notFound();
  const falta = [seccion.permiso, permiso].find((p) => p && !puede(empresa, p));
  if (falta) {
    await anotarDenegado(orgId, falta);
    redirect(`/empresa/${orgId}/sin-acceso?que=${falta}`);
  }
  return empresa;
}

// Para las acciones del servidor: la empresa, si el rol tiene el permiso. Si no, anota el intento y devuelve
// null para que cada acción conteste con su mensaje. La base vuelve a controlar todo con sus políticas.
export async function exigir(orgId: string, permiso: Permiso) {
  const empresa = await empresaActual(orgId);
  if (puede(empresa, permiso)) return empresa;
  await anotarDenegado(orgId, permiso);
  return null;
}

// Deja en la actividad de la empresa un intento de hacer algo que el rol no permite. Si no se puede anotar,
// no traba nada.
async function anotarDenegado(orgId: string, permiso: Permiso) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('auditar_denegado', { p_org: orgId, p_que: permiso });
  if (error && error.code !== 'PGRST202') avisarError('anotarDenegado', error);
}
