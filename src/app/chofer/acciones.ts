'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoApp } from '@/lib/apps';
import { rutasValidas } from '@/lib/fotos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export type ResultadoSalida = { error?: string; bloqueado?: { fallas: number } };

const entero = (v: unknown) => {
  const t = String(v ?? '').toLowerCase().replace(/km\.?$/, '').replace(/[\s.]/g, '');
  return /^\d+$/.test(t) ? Number(t) : null;
};
const monto = (v: unknown) => {
  // "$ 125.000,50" → 125000.5
  const t = String(v ?? '').replace(/[$\s.]/g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
};
// Mensajes que escribe la base (en castellano); el resto se traduce a algo genérico.
const mensajeBase = (e: { message: string }) =>
  /^(Falta|El |La |Ya |No |Cargá|Indicá|Contá)/.test(e.message) ? e.message : 'No pudimos guardar. Probá de nuevo en unos segundos.';

type Respuesta = { estado: 'ok' | 'problema'; nota?: string; fotos?: string[] };

// Chequeo previo y salida. Si hay una falla crítica, la base no deja salir y avisa al taller.
export async function iniciarViaje(codigo: string, datos: { km: string; combustible: number | null; destino: string; respuestas: Record<string, Respuesta> }): Promise<ResultadoSalida> {
  const { organizacion } = await contextoApp('chofer');
  const km = entero(datos.km);
  if (km === null) return { error: 'Escribí el kilometraje del tablero sólo con números.' };
  if (datos.combustible === null) return { error: 'Indicá el nivel de combustible.' };
  const items = Object.fromEntries(
    Object.entries(datos.respuestas).map(([clave, r]) => [
      clave,
      r.estado === 'problema'
        ? { estado: 'problema', nota: (r.nota ?? '').slice(0, 500), fotos: rutasValidas(organizacion.id, r.fotos ?? []) }
        : { estado: 'ok' },
    ]),
  );
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('iniciar_viaje', {
    p_token: codigo, p_km: km, p_combustible: datos.combustible, p_items: items, p_destino: datos.destino.slice(0, 120),
  });
  if (error) {
    avisarError('iniciarViaje', error);
    return { error: mensajeBase(error) };
  }
  revalidatePath('/chofer');
  if (data?.estado === 'bloqueado') return { bloqueado: { fallas: data.fallas_criticas } };
  redirect('/chofer?ok=viaje-iniciado');
}

export type EstadoForm = { error?: string; errores?: Record<string, string> };

export async function terminarViaje(viaje: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  await contextoApp('chofer');
  const km = entero(form.get('km'));
  const combustible = entero(form.get('combustible'));
  if (km === null) return { errores: { km: 'Escribí el kilometraje del tablero sólo con números.' } };
  if (combustible === null) return { error: 'Indicá el nivel de combustible.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('terminar_viaje', {
    p_viaje: viaje, p_km: km, p_combustible: combustible, p_observaciones: String(form.get('observaciones') ?? '').slice(0, 500),
  });
  if (error) {
    avisarError('terminarViaje', error);
    return /kilometraje/.test(error.message) ? { errores: { km: mensajeBase(error) } } : { error: mensajeBase(error) };
  }
  revalidatePath('/chofer');
  redirect('/chofer?ok=viaje-terminado');
}

const CATEGORIAS_CHOFER = ['combustible', 'peaje', 'viatico', 'otro'];

export async function cargarGasto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { organizacion, usuario } = await contextoApp('chofer');
  const categoria = String(form.get('categoria') ?? '');
  const importe = monto(form.get('monto'));
  const litrosTxt = String(form.get('litros') ?? '').trim();
  const litros = litrosTxt ? monto(litrosTxt) : null;
  const errores: Record<string, string> = {};
  if (!CATEGORIAS_CHOFER.includes(categoria)) errores.categoria = 'Elegí qué tipo de gasto es.';
  if (!importe || importe <= 0) errores.monto = 'Escribí el importe, por ejemplo 125.000.';
  if (litrosTxt && (!litros || litros <= 0)) errores.litros = 'Escribí los litros con números, por ejemplo 180 o 180,5.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  const [{ data: miembro }, { data: viaje }] = await Promise.all([
    supabase.from('miembros').select('chofer_id').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).maybeSingle(),
    supabase.from('viajes').select('id, unidad_id').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'en_curso').maybeSingle(),
  ]);
  const foto = rutasValidas(organizacion.id, form.getAll('foto'))[0] ?? null;
  const { error } = await supabase.from('gastos').insert({
    organizacion_id: organizacion.id, categoria, monto: importe, litros: categoria === 'combustible' ? litros : null,
    unidad_id: viaje?.unidad_id ?? null, viaje_id: viaje?.id ?? null, chofer_id: miembro?.chofer_id ?? null,
    descripcion: String(form.get('descripcion') ?? '').trim().slice(0, 200) || null, foto,
  });
  if (error) {
    avisarError('cargarGasto', error);
    return { error: 'No pudimos guardar el gasto. Probá de nuevo en unos segundos.' };
  }
  revalidatePath('/chofer');
  redirect('/chofer?ok=gasto');
}

export async function reportarFalla(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { organizacion, usuario } = await contextoApp('chofer');
  const unidad = String(form.get('unidad') ?? '');
  const sistema = String(form.get('sistema') ?? '').slice(0, 40);
  const descripcion = String(form.get('descripcion') ?? '').trim().slice(0, 500);
  const fotos = rutasValidas(organizacion.id, form.getAll('fotos'));
  const errores: Record<string, string> = {};
  if (!sistema) errores.sistema = 'Elegí qué parte de la unidad falla.';
  if (!descripcion && !fotos.length) errores.descripcion = 'Contá qué pasa o sacá una foto.';
  const grave = form.get('grave');
  if (grave !== 'si' && grave !== 'no') errores.grave = 'Indicá si podés seguir viaje.';
  if (Object.keys(errores).length) return { errores };

  const supabase = await crearClienteServidor();
  const [{ data: miembro }, { data: viaje }] = await Promise.all([
    supabase.from('miembros').select('chofer_id').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).maybeSingle(),
    supabase.from('viajes').select('id').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'en_curso').maybeSingle(),
  ]);
  const { error } = await supabase.from('fallas').insert({
    organizacion_id: organizacion.id, unidad_id: unidad, sistema, descripcion: descripcion || null, fotos,
    gravedad: form.get('grave') === 'si' ? 'critica' : 'moderada', origen: 'viaje',
    viaje_id: viaje?.id ?? null, chofer_id: miembro?.chofer_id ?? null,
  });
  if (error) {
    avisarError('reportarFalla', error);
    return { error: 'No pudimos enviar el aviso. Probá de nuevo en unos segundos.' };
  }
  revalidatePath('/chofer');
  redirect('/chofer?ok=falla');
}
