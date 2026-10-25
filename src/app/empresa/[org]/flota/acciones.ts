'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigir, UUID } from '@/lib/empresa';
import { hoyISO } from '@/lib/fechas';
import { leerChofer, leerKm, leerUnidad, mensajeDeError, type Errores } from '@/lib/flota';
import { rutasValidas } from '@/lib/fotos';
import type { Permiso } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { leerFalla } from '@/lib/taller';

// `valores` y `clave` devuelven lo que la persona escribió para no perderlo si hay que corregir algo.
export type EstadoForm = { error?: string; errores?: Errores; ok?: string; valores?: Record<string, string>; clave?: number; subirPlan?: string };

// La base vuelve a controlar todo con sus políticas; esto da un mensaje claro antes de intentar.
async function verificar(org: string, permiso: Permiso, id?: string) {
  if (!(await exigir(org, permiso))) return 'Tu rol no permite hacer este cambio.';
  if (id !== undefined && !UUID.test(id)) return 'No encontramos ese registro.';
  return null;
}

function devolver(form: FormData | null, estado: EstadoForm): EstadoForm {
  if (!form) return estado;
  const valores = Object.fromEntries([...form.entries()].filter((e): e is [string, string] => typeof e[1] === 'string'));
  return { ...estado, valores, clave: Date.now() };
}

// Patente repetida (23505) y unidad con historia (23503) son errores esperables de carga: se avisan en pantalla,
// pero no ensucian el registro del servidor, que queda para fallas reales.
const ESPERABLES = ['23505', '23503'];

function fallo(donde: string, form: FormData | null, error: { code?: string; message: string }): EstadoForm {
  if (!ESPERABLES.includes(error.code ?? '')) avisarError(donde, error);
  const mensaje = mensajeDeError(error)!;
  return devolver(form, error.code === '23505' ? { error: mensaje, errores: { dominio: mensaje } } : { error: mensaje });
}

const refrescar = (org: string) => revalidatePath(`/empresa/${org}`, 'layout');

// Si la unidad no entra en el plan, el formulario ofrece ir a subir de plan.
const conCupo = (org: string, estado: EstadoForm, error: { hint?: string | null }) =>
  error.hint === 'cupo_unidades' ? { ...estado, subirPlan: `/empresa/${org}/suscripcion` } : estado;

// ───────────── Unidades ─────────────
export async function crearUnidad(org: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar');
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const { datos, errores } = leerUnidad(form);
  if (!datos) return devolver(form, { errores });

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('unidades').insert({ ...datos, organizacion_id: org }).select('id').single();
  if (error) return conCupo(org, fallo('crearUnidad', form, error), error);
  if (datos.km !== null) {
    const { error: e } = await supabase.from('lecturas_km').insert({ organizacion_id: org, unidad_id: data.id, km: datos.km, fecha: hoyISO(), origen: 'alta' });
    avisarError('crearUnidad/lectura', e);
  }
  refrescar(org);
  redirect(`/empresa/${org}/flota/unidades/${data.id}?ok=creada`);
}

export async function editarUnidad(org: string, id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar', id);
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const { datos, errores } = leerUnidad(form);
  if (!datos) return devolver(form, { errores });

  const supabase = await crearClienteServidor();
  const { data: antes } = await supabase.from('unidades').select('km').eq('id', id).eq('organizacion_id', org).maybeSingle();
  const { data, error } = await supabase.from('unidades').update(datos).eq('id', id).eq('organizacion_id', org).select('id');
  if (error) return conCupo(org, fallo('editarUnidad', form, error), error);
  if (!data?.length) return devolver(form, { error: 'No encontramos la unidad. Puede que la hayan eliminado.' });
  // Un cambio de kilometraje desde Editar queda en el historial; si baja, es una corrección de carga.
  if (datos.km !== null && datos.km !== antes?.km) {
    const origen = antes?.km != null && datos.km < antes.km ? 'correccion' : 'edicion';
    const { error: e } = await supabase.from('lecturas_km').insert({ organizacion_id: org, unidad_id: id, km: datos.km, fecha: hoyISO(), origen });
    avisarError('editarUnidad/lectura', e);
  }
  refrescar(org);
  redirect(`/empresa/${org}/flota/unidades/${id}?ok=guardada`);
}

export async function eliminarUnidad(org: string, id: string): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.borrar', id);
  if (sinPermiso) return { error: sinPermiso };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('unidades').delete().eq('id', id).eq('organizacion_id', org).select('id');
  if (error) return fallo('eliminarUnidad', null, error);
  if (!data?.length) return { error: 'No encontramos la unidad. Puede que ya la hayan eliminado.' };
  refrescar(org);
  redirect(`/empresa/${org}/flota?ok=unidad-eliminada`);
}

export async function registrarKm(org: string, id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar', id);
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const supabase = await crearClienteServidor();
  const { data: unidad } = await supabase.from('unidades').select('km').eq('id', id).eq('organizacion_id', org).maybeSingle();
  if (!unidad) return devolver(form, { error: 'No encontramos la unidad.' });
  const { km, errores } = leerKm(form, unidad.km);
  if (km === undefined) return devolver(form, { errores });
  const { error } = await supabase.from('lecturas_km').insert({ organizacion_id: org, unidad_id: id, km, fecha: hoyISO(), origen: 'manual' });
  if (error) return fallo('registrarKm', form, error);
  refrescar(org);
  return { ok: `Kilometraje actualizado a ${km.toLocaleString('es-AR')} km.`, clave: Date.now() };
}

// Falla avisada desde la oficina (un llamado del chofer, algo que se vio en la base): llega al taller como las demás.
export async function reportarFalla(org: string, id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar', id);
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const fotos = rutasValidas(org, form.getAll('fotos'));
  const { datos, errores } = leerFalla(form, fotos.length > 0);
  if (!datos) return devolver(form, { errores });
  const supabase = await crearClienteServidor();
  const { data: unidad } = await supabase.from('unidades').select('id').eq('id', id).eq('organizacion_id', org).maybeSingle();
  if (!unidad) return devolver(form, { error: 'No encontramos la unidad. Puede que la hayan eliminado.' });
  const { error } = await supabase.from('fallas').insert({ ...datos, organizacion_id: org, unidad_id: id, fotos, origen: 'administracion' });
  if (error) return fallo('reportarFalla', form, error);
  refrescar(org);
  redirect(`/empresa/${org}/flota/unidades/${id}?ok=falla`);
}

// ───────────── Choferes ─────────────
export async function crearChofer(org: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar');
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const { datos, errores } = leerChofer(form);
  if (!datos) return devolver(form, { errores });
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('choferes').insert({ ...datos, organizacion_id: org });
  if (error) return fallo('crearChofer', form, error);
  refrescar(org);
  redirect(`/empresa/${org}/flota?ok=chofer-creado`);
}

export async function editarChofer(org: string, id: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar', id);
  if (sinPermiso) return devolver(form, { error: sinPermiso });
  const { datos, errores } = leerChofer(form);
  if (!datos) return devolver(form, { errores });
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('choferes').update(datos).eq('id', id).eq('organizacion_id', org).select('id');
  if (error) return fallo('editarChofer', form, error);
  if (!data?.length) return devolver(form, { error: 'No encontramos al chofer. Puede que lo hayan eliminado.' });
  refrescar(org);
  redirect(`/empresa/${org}/flota?ok=chofer-guardado`);
}

export async function eliminarChofer(org: string, id: string): Promise<EstadoForm> {
  const sinPermiso = await verificar(org, 'flota.editar', id);
  if (sinPermiso) return { error: sinPermiso };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('choferes').delete().eq('id', id).eq('organizacion_id', org).select('id');
  if (error) return fallo('eliminarChofer', null, error);
  if (!data?.length) return { error: 'No encontramos al chofer. Puede que ya lo hayan eliminado.' };
  refrescar(org);
  redirect(`/empresa/${org}/flota?ok=chofer-eliminado`);
}
