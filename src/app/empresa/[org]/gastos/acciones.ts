'use server';

import { revalidatePath } from 'next/cache';
import { exigir, UUID } from '@/lib/empresa';
import { hoyISO } from '@/lib/fechas';
import { rutasValidas } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export type EstadoGasto = { error?: string; errores?: Record<string, string>; ok?: string; clave?: number };

const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'neumaticos', 'seguro', 'patente', 'multa', 'lavado', 'otro'];
const importe = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').replace(/[$\s.]/g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
};

export async function crearGasto(org: string, _: EstadoGasto, form: FormData): Promise<EstadoGasto> {
  if (!(await exigir(org, 'gastos.editar'))) return { error: 'Tu rol no permite cargar gastos.' };
  const categoria = String(form.get('categoria') ?? '');
  const monto = importe(form.get('monto'));
  const litrosTxt = String(form.get('litros') ?? '').trim();
  const litros = litrosTxt ? importe(litrosTxt) : null;
  const fecha = String(form.get('fecha') ?? '') || hoyISO();
  const unidad = String(form.get('unidad') ?? '');
  const chofer = String(form.get('chofer') ?? '');
  const errores: Record<string, string> = {};
  if (!CATEGORIAS.includes(categoria)) errores.categoria = 'Elegí una categoría.';
  if (!monto || monto <= 0) errores.monto = 'Escribí el importe, por ejemplo 125.000.';
  if (litrosTxt && !litros) errores.litros = 'Escribí los litros con números.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO()) errores.fecha = 'La fecha no puede ser futura.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('gastos').insert({
    organizacion_id: org, categoria, monto, fecha,
    litros: categoria === 'combustible' ? litros : null,
    unidad_id: UUID.test(unidad) ? unidad : null,
    chofer_id: UUID.test(chofer) ? chofer : null,
    descripcion: String(form.get('descripcion') ?? '').trim().slice(0, 200) || null,
    foto: rutasValidas(org, form.getAll('foto'))[0] ?? null,
  });
  if (error) {
    avisarError('crearGasto', error);
    return { error: 'No pudimos guardar el gasto. Probá de nuevo en unos segundos.' };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return { ok: 'Gasto guardado', clave: Date.now() };
}

export async function eliminarGasto(org: string, id: string): Promise<{ error?: string }> {
  if (!(await exigir(org, 'gastos.editar'))) return { error: 'Tu rol no permite borrar gastos.' };
  if (!UUID.test(id)) return { error: 'No encontramos ese gasto.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('gastos').delete().eq('id', id).eq('organizacion_id', org);
  if (error) {
    avisarError('eliminarGasto', error);
    return { error: 'No pudimos eliminar el gasto. Probá de nuevo en unos segundos.' };
  }
  revalidatePath(`/empresa/${org}`, 'layout');
  return {};
}
