'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { rutasValidas } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export type EstadoForm = { error?: string; errores?: Record<string, string> };

const pesos = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').replace(/[$\s.]/g, '').replace(',', '.');
  if (!t) return 0;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
};
const entero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').toLowerCase().replace(/km\.?$/, '').replace(/[\s.]/g, '');
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
};
const mensajeBase = (e: { message: string }) =>
  /^(Contá|No |La |El )/.test(e.message) ? e.message : 'No pudimos guardar. Probá de nuevo en unos segundos.';

function leerCostos(form: FormData) {
  const errores: Record<string, string> = {};
  const repuestos = pesos(form.get('repuestos'));
  const manoObra = pesos(form.get('mano_obra'));
  const km = entero(form.get('km'));
  if (Number.isNaN(repuestos)) errores.repuestos = 'Escribí sólo el importe, por ejemplo 85.000.';
  if (Number.isNaN(manoObra)) errores.mano_obra = 'Escribí sólo el importe, por ejemplo 30.000.';
  if (Number.isNaN(km)) errores.km = 'Escribí el kilometraje sólo con números.';
  return { errores, repuestos, manoObra, km: Number.isNaN(km) ? null : km };
}

// Un trabajo terminado en un paso: crea la orden cerrada y resuelve las fallas elegidas.
export async function registrarTrabajo(unidad: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { organizacion } = await contextoApp('taller');
  const descripcion = String(form.get('descripcion') ?? '').trim().slice(0, 200);
  const trabajo = String(form.get('trabajo') ?? '').trim().slice(0, 1000);
  const tipo = form.get('tipo') === 'preventivo' ? 'preventivo' : 'correctivo';
  const fallas = form.getAll('fallas').filter((f): f is string => typeof f === 'string' && UUID.test(f));
  const { errores, repuestos, manoObra, km } = leerCostos(form);
  if (!descripcion) errores.descripcion = 'Contá en pocas palabras qué trabajo se hizo.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('registrar_trabajo', {
    p_unidad: unidad, p_tipo: tipo, p_descripcion: descripcion, p_trabajo: trabajo,
    p_fotos: rutasValidas(organizacion.id, form.getAll('fotos')), p_repuestos: repuestos, p_mano_obra: manoObra, p_km: km, p_fallas: fallas,
  });
  if (error) {
    avisarError('registrarTrabajo', error);
    return { error: mensajeBase(error) };
  }
  revalidatePath('/taller', 'layout');
  redirect(`/taller/unidad/${unidad}?ok=trabajo`);
}

// Una reparación larga: queda abierta y la unidad, si hace falta, parada.
export async function abrirOrden(unidad: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  await contextoApp('taller');
  const descripcion = String(form.get('descripcion') ?? '').trim().slice(0, 200);
  if (!descripcion) return { errores: { descripcion: 'Contá qué hay que hacer.' } };
  const fallas = form.getAll('fallas').filter((f): f is string => typeof f === 'string' && UUID.test(f));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('abrir_orden', {
    p_unidad: unidad, p_descripcion: descripcion, p_tipo: 'correctivo', p_fallas: fallas, p_deja_fuera_servicio: form.get('parada') !== 'no',
  });
  if (error) {
    avisarError('abrirOrden', error);
    return { error: mensajeBase(error) };
  }
  revalidatePath('/taller', 'layout');
  redirect(`/taller/unidad/${unidad}?ok=orden`);
}

export async function cerrarOrden(orden: string, unidad: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { organizacion } = await contextoApp('taller');
  const trabajo = String(form.get('trabajo') ?? '').trim().slice(0, 1000);
  const { errores, repuestos, manoObra, km } = leerCostos(form);
  if (!trabajo) errores.trabajo = 'Contá qué se hizo.';
  if (Object.keys(errores).length) return { errores };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('cerrar_orden', {
    p_orden: orden, p_trabajo: trabajo, p_fotos: rutasValidas(organizacion.id, form.getAll('fotos')),
    p_repuestos: repuestos, p_mano_obra: manoObra, p_km: km,
  });
  if (error) {
    avisarError('cerrarOrden', error);
    return { error: mensajeBase(error) };
  }
  revalidatePath('/taller', 'layout');
  redirect(`/taller/unidad/${unidad}?ok=cerrada`);
}

// Una falla que no corresponde (por ejemplo, un error al reportar).
export async function descartarFalla(falla: string, unidad: string): Promise<void> {
  await contextoApp('taller');
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('descartar_falla', { p_falla: falla });
  avisarError('descartarFalla', error);
  revalidatePath('/taller', 'layout');
  redirect(`/taller/unidad/${unidad}?ok=descartada`);
}
