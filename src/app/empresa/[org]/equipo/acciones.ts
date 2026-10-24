'use server';

import { revalidatePath } from 'next/cache';
import { exigir, UUID, type Rol } from '@/lib/empresa';
import { ROLES_DE } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { urlBase } from '@/lib/url';

export type EstadoInvitacion = { error?: string; errores?: Record<string, string>; enlace?: string; nombre?: string; rol?: Rol; clave?: number };

// Crea un enlace de invitación de un solo uso (vence en 7 días). Para choferes, crea su ficha si hace falta.
export async function crearInvitacion(org: string, _: EstadoInvitacion, form: FormData): Promise<EstadoInvitacion> {
  const empresa = await exigir(org, 'equipo.administrar');
  if (!empresa) return { error: 'Sólo el administrador invita personas.' };
  const nombre = String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const rol = String(form.get('rol') ?? '') as Rol;
  const choferElegido = String(form.get('chofer') ?? '');
  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = 'Escribí el nombre de la persona.';
  if (!ROLES_DE[empresa.organizacion.tipo].includes(rol)) errores.rol = 'Elegí qué va a hacer en la empresa.';
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
  if (!(await exigir(org, 'equipo.administrar')) || !UUID.test(id)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('invitaciones').update({ revocada: true }).eq('id', id).eq('organizacion_id', org);
  avisarError('revocarInvitacion', error);
  revalidatePath(`/empresa/${org}/equipo`);
}

export async function cambiarRol(org: string, usuario: string, form: FormData) {
  const empresa = await exigir(org, 'equipo.administrar');
  const rol = String(form.get('rol') ?? '') as Rol;
  if (!empresa || usuario === empresa.usuario.id || !UUID.test(usuario) || !ROLES_DE[empresa.organizacion.tipo].includes(rol)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('miembros').update({ rol }).eq('organizacion_id', org).eq('user_id', usuario);
  avisarError('cambiarRol', error);
  revalidatePath(`/empresa/${org}/equipo`);
}

export async function quitarMiembro(org: string, usuario: string) {
  const empresa = await exigir(org, 'equipo.administrar');
  if (!empresa || usuario === empresa.usuario.id || !UUID.test(usuario)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('miembros').delete().eq('organizacion_id', org).eq('user_id', usuario);
  avisarError('quitarMiembro', error);
  revalidatePath(`/empresa/${org}/equipo`);
}
