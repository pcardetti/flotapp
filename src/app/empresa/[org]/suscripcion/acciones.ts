'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigir } from '@/lib/empresa';
import { pasarela } from '@/lib/pagos';
import { seCotiza, type Periodo } from '@/lib/planes';
import { planesPublicos, suscripcionDe } from '@/lib/suscripcion';
import { urlBase } from '@/lib/url';

export type EstadoPlan = { error?: string };

// Elegir (o cambiar) el plan: valida que las unidades en servicio entren y manda a pagar a la pasarela.
export async function elegirPlan(org: string, _: EstadoPlan, form: FormData): Promise<EstadoPlan> {
  const empresa = await exigir(org, 'suscripcion.administrar');
  if (!empresa) return { error: 'Sólo el administrador maneja la suscripción.' };
  const periodo: Periodo = form.get('periodo') === 'anual' ? 'anual' : 'mensual';
  const plan = (await planesPublicos()).find((p) => p.clave === form.get('plan'));
  if (!plan || seCotiza(plan)) return { error: 'Elegí uno de los planes de la lista.' };
  const actual = await suscripcionDe(org);
  if (!actual) return { error: 'No encontramos la suscripción. Recargá la página y probá de nuevo.' };
  if (plan.max_unidades !== null && actual.unidades > plan.max_unidades) {
    return { error: `Tenés ${actual.unidades} unidades en servicio y el plan ${plan.nombre} permite ${plan.max_unidades}. Da de baja las que no uses o elegí un plan más grande.` };
  }
  const cobro = pasarela();
  if (!cobro) return { error: 'El pago en línea todavía no está habilitado. Escribinos desde la página de inicio y te damos de alta.' };
  const resultado = await cobro.contratar({
    org,
    empresa: empresa.organizacion.nombre,
    plan,
    periodo,
    email: empresa.usuario.email ?? '',
    actual,
    volver: `${await urlBase()}/empresa/${org}/suscripcion`,
  });
  if ('error' in resultado) return { error: resultado.error };
  revalidatePath(`/empresa/${org}`, 'layout');
  redirect(resultado.url);
}

// La baja rige al terminar el período pago; hasta entonces todo sigue igual.
export async function cancelarSuscripcion(org: string): Promise<{ error?: string }> {
  if (!(await exigir(org, 'suscripcion.administrar'))) return { error: 'Sólo el administrador maneja la suscripción.' };
  const actual = await suscripcionDe(org);
  if (!actual || actual.estado !== 'activa' || !actual.periodo_hasta) return { error: 'No hay un plan pago activo para dar de baja.' };
  const cobro = pasarela();
  if (!cobro) return { error: 'Para dar de baja el plan, escribinos desde la página de inicio.' };
  const resultado = await cobro.cancelar({ org, actual });
  if (resultado.error) return resultado;
  revalidatePath(`/empresa/${org}`, 'layout');
  return {};
}
