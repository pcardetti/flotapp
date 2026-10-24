'use server';

import { revalidatePath } from 'next/cache';
import { exigir, UUID } from '@/lib/empresa';
import { mensajeDe } from '@/lib/errores';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export type EstadoTipo = { error?: string; ok?: string; clave?: number };

function leer(form: FormData) {
  const nombre = String(form.get('nombre') ?? '').trim().slice(0, 80);
  const aplica = form.get('aplica') === 'chofer' ? 'chofer' : 'unidad';
  const vigencia = Number(form.get('vigencia_meses'));
  const aviso = Number(form.get('aviso_dias'));
  if (!nombre) return { error: 'Escribí el nombre del documento.' };
  if (!Number.isInteger(vigencia) || vigencia < 1 || vigencia > 120) return { error: 'La vigencia va de 1 a 120 meses.' };
  if (!Number.isInteger(aviso) || aviso < 0 || aviso > 365) return { error: 'El aviso va de 0 a 365 días.' };
  return { datos: { nombre, aplica, vigencia_meses: vigencia, aviso_dias: aviso } };
}

export async function guardarTipo(org: string, id: string | null, _: EstadoTipo, form: FormData): Promise<EstadoTipo> {
  if (!(await exigir(org, 'ajustes.editar'))) return { error: 'Sólo el administrador cambia los ajustes.' };
  const { datos, error: invalido } = leer(form);
  if (!datos) return { error: invalido };
  const supabase = await crearClienteServidor();
  const { error } = id && UUID.test(id)
    ? await supabase.from('tipos_documento').update(datos).eq('id', id).eq('organizacion_id', org)
    : await supabase.from('tipos_documento').insert({ ...datos, organizacion_id: org });
  if (error) {
    avisarError('guardarTipo', error);
    return { error: mensajeDe(error, 'No pudimos guardar. Probá de nuevo en unos segundos.') };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return { ok: id ? 'Guardado' : 'Tipo agregado', clave: Date.now() };
}

export async function eliminarTipo(org: string, id: string): Promise<{ error?: string }> {
  if (!(await exigir(org, 'ajustes.editar'))) return { error: 'Sólo el administrador cambia los ajustes.' };
  if (!UUID.test(id)) return { error: 'No encontramos ese tipo de documento.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('tipos_documento').delete().eq('id', id).eq('organizacion_id', org);
  if (error) {
    avisarError('eliminarTipo', error);
    return { error: mensajeDe(error, 'No pudimos eliminar el tipo de documento. Probá de nuevo en unos segundos.') };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return {};
}
