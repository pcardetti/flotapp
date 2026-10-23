'use server';

import { revalidatePath } from 'next/cache';
import { anotarDenegado, empresaActual, esGestor, UUID } from '@/lib/empresa';
import { rutasValidas } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export type EstadoDoc = { error?: string; errores?: Record<string, string>; ok?: string; clave?: number };

const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));

async function permitido(org: string) {
  const { rol } = await empresaActual(org);
  if (!esGestor(rol)) await anotarDenegado(org, 'vencimientos');
  return esGestor(rol);
}

export async function crearDocumento(org: string, _: EstadoDoc, form: FormData): Promise<EstadoDoc> {
  if (!(await permitido(org))) return { error: 'Tu rol no permite cargar documentos.' };
  const titular = String(form.get('titular') ?? '');
  const tipo = String(form.get('tipo') ?? '');
  const vence = String(form.get('vence') ?? '');
  const [clase, id] = titular.split(':');
  const errores: Record<string, string> = {};
  if (!(clase === 'u' || clase === 'c') || !UUID.test(id ?? '')) errores.titular = 'Elegí una unidad o un chofer.';
  if (!UUID.test(tipo)) errores.tipo = 'Elegí el tipo de documento.';
  if (!fechaValida(vence)) errores.vence = 'Indicá la fecha de vencimiento.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('documentos').insert({
    organizacion_id: org, tipo_documento_id: tipo, vence,
    unidad_id: clase === 'u' ? id : null, chofer_id: clase === 'c' ? id : null,
    numero: String(form.get('numero') ?? '').trim().slice(0, 60) || null,
    foto: rutasValidas(org, form.getAll('foto'))[0] ?? null,
  });
  if (error) {
    avisarError('crearDocumento', error);
    return { error: 'No pudimos guardar el documento. Probá de nuevo en unos segundos.' };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return { ok: 'Documento agregado', clave: Date.now() };
}

export async function renovarDocumento(org: string, id: string, _: EstadoDoc, form: FormData): Promise<EstadoDoc> {
  if (!(await permitido(org))) return { error: 'Tu rol no permite renovar documentos.' };
  const vence = String(form.get('vence') ?? '');
  if (!fechaValida(vence)) return { errores: { vence: 'Indicá la nueva fecha de vencimiento.' } };
  const foto = rutasValidas(org, form.getAll('foto'))[0];
  const numero = String(form.get('numero') ?? '').trim().slice(0, 60);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('documentos')
    .update({ vence, ...(foto ? { foto } : {}), ...(numero ? { numero } : {}) })
    .eq('id', id).eq('organizacion_id', org);
  if (error) {
    avisarError('renovarDocumento', error);
    return { error: 'No pudimos renovarlo. Probá de nuevo en unos segundos.' };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return { ok: 'Renovado', clave: Date.now() };
}

export async function eliminarDocumento(org: string, id: string) {
  if (!(await permitido(org)) || !UUID.test(id)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('documentos').delete().eq('id', id).eq('organizacion_id', org);
  avisarError('eliminarDocumento', error);
  revalidatePath(`/empresa/${org}`, 'layout');
}
