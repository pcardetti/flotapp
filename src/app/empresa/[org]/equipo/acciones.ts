'use server';

import { revalidatePath } from 'next/cache';
import { anotarDenegado, empresaActual, UUID, type Rol } from '@/lib/empresa';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { urlBase } from '@/lib/url';

export type EstadoInvitacion = { error?: string; errores?: Record<string, string>; enlace?: string; nombre?: string; rol?: Rol; clave?: number };

const ROLES_FLOTA: Rol[] = ['chofer', 'mecanico', 'jefe_taller', 'lectura', 'admin'];
const ROLES_PROVEEDOR: Rol[] = ['operario', 'admin'];

async function soloAdmin(org: string) {
  const e = await empresaActual(org);
  if (e.rol !== 'admin') {
    await anotarDenegado(org, 'equipo');
    throw new Error('Sólo el administrador gestiona el equipo');
  }
  return e;
}

// Crea un enlace de invitación de un solo uso (vence en 7 días). Para choferes, crea su ficha si hace falta.
export async function crearInvitacion(org: string, _: EstadoInvitacion, form: FormData): Promise<EstadoInvitacion> {
  const { organizacion } = await soloAdmin(org);
  const nombre = String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const rol = String(form.get('rol') ?? '') as Rol;
  const choferElegido = String(form.get('chofer') ?? '');
  const permitidos = organizacion.tipo === 'flota' ? ROLES_FLOTA : ROLES_PROVEEDOR;
  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = 'Escribí el nombre de la persona.';
  if (!permitidos.includes(rol)) errores.rol = 'Elegí qué va a hacer en la empresa.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  let choferId: string | null = null;
  if (rol === 'chofer') {
    if (UUID.test(choferElegido)) choferId = choferElegido;
    else {
      const { data, error } = await supabase.from('choferes').insert({ organizacion_id: org, nombre }).select('id').single();
      if (error) {
        avisarError('crearInvitacion/chofer', error);
        return { error: 'No pudimos crear la ficha del chofer. Probá de nuevo.' };
      }
      choferId = data.id;
    }
  }
  const { data, error } = await supabase.from('invitaciones').insert({ organizacion_id: org, rol, nombre, chofer_id: choferId }).select('token').single();
  if (error) {
    avisarError('crearInvitacion', error);
    return { error: 'No pudimos crear la invitación. Si todavía no ejecutaste la migración 0002 en Supabase, hacelo y probá de nuevo.' };
  }
  revalidatePath(`/empresa/${org}/equipo`);
  return { enlace: `${await urlBase()}/invitacion/${data.token}`, nombre, rol, clave: Date.now() };
}

export async function revocarInvitacion(org: string, id: string) {
  await soloAdmin(org);
  if (!UUID.test(id)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('invitaciones').update({ revocada: true }).eq('id', id).eq('organizacion_id', org);
  avisarError('revocarInvitacion', error);
  revalidatePath(`/empresa/${org}/equipo`);
}

export async function cambiarRol(org: string, usuario: string, form: FormData) {
  const { usuario: yo, organizacion } = await soloAdmin(org);
  const rol = String(form.get('rol') ?? '') as Rol;
  const permitidos = organizacion.tipo === 'flota' ? ROLES_FLOTA : ROLES_PROVEEDOR;
  if (usuario === yo.id || !UUID.test(usuario) || !permitidos.includes(rol)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('miembros').update({ rol }).eq('organizacion_id', org).eq('user_id', usuario);
  avisarError('cambiarRol', error);
  revalidatePath(`/empresa/${org}/equipo`);
}

export async function quitarMiembro(org: string, usuario: string) {
  const { usuario: yo } = await soloAdmin(org);
  if (usuario === yo.id || !UUID.test(usuario)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('miembros').delete().eq('organizacion_id', org).eq('user_id', usuario);
  avisarError('quitarMiembro', error);
  revalidatePath(`/empresa/${org}/equipo`);
}
