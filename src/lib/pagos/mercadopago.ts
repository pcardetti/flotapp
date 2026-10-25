import { randomUUID } from 'node:crypto';
import { UUID } from '@/lib/empresa';
import { precioDe, type Periodo, type Plan } from '@/lib/planes';
import { guardarCobro, guardarSuscripcion } from './base';
import { estaCancelada, estadoDeCobro, estadoDeSuscripcion, type PagoAutorizado, type Preaprobacion } from './estados';
import type { Pasarela } from './index';

// Mercado Pago Suscripciones ("sin plan asociado"): cada flota tiene una preaprobación de cobro recurrente con su
// monto y período. Se crea pendiente y la persona la autoriza en Mercado Pago con su tarjeta; desde ahí los cobros
// son automáticos. Cada novedad llega como aviso (api/pagos/mercadopago) y, al volver de pagar, la app la consulta
// enseguida (empresa/<id>/suscripcion/volver).
// Variables (sólo servidor): MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y FLOTAPP_SECRETO_PAGOS.

const API = 'https://api.mercadopago.com';

export const mercadoPagoConfigurado = () => Boolean(process.env.MP_ACCESS_TOKEN && process.env.FLOTAPP_SECRETO_PAGOS);

class ErrorDeMercadoPago extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

async function pedir<T>(ruta: string, opciones: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(API + ruta, {
    method: opciones.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(opciones.method === 'POST' ? { 'X-Idempotency-Key': randomUUID() } : {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    cache: 'no-store',
    // Un aviso tiene que contestarse en menos de 22 segundos.
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) throw new ErrorDeMercadoPago(respuesta.status, `Mercado Pago ${respuesta.status} en ${ruta}: ${(await respuesta.text()).slice(0, 300)}`);
  return respuesta.json() as Promise<T>;
}

// La referencia externa lleva la empresa, el plan, el período y, si la suscripción nueva reemplaza a otra (cambio
// de período o nueva contratación), la anterior, que se da de baja cuando la nueva queda autorizada. Así cada aviso
// sabe a quién aplicar.
const referencia = (org: string, plan: string, periodo: Periodo, anterior?: string | null) => [org, plan, periodo, anterior ?? ''].join('|');
function leerReferencia(texto: string | null) {
  const [org, plan, periodo, anterior] = (texto ?? '').split('|');
  if (!UUID.test(org ?? '') || !plan || (periodo !== 'mensual' && periodo !== 'anual')) return null;
  return { org, plan, periodo: periodo as Periodo, anterior: anterior || null };
}

const motivo = (plan: Plan, periodo: Periodo, empresa: string) => `Tallerflota · Plan ${plan.nombre} (${periodo === 'anual' ? 'anual' : 'mensual'}) · ${empresa}`.slice(0, 120);

// Da de baja una suscripción en Mercado Pago, si no lo estaba. La documentación pide "canceled" y los SDK oficiales
// mandan "cancelled": se prueba una y, si Mercado Pago la rechaza, la otra.
async function darDeBaja(id: string) {
  if (estaCancelada((await pedir<Preaprobacion>(`/preapproval/${id}`)).status)) return;
  try {
    await pedir(`/preapproval/${id}`, { method: 'PUT', body: { status: 'cancelled' } });
  } catch (e) {
    if (!(e instanceof ErrorDeMercadoPago) || e.estado !== 400) throw e;
    await pedir(`/preapproval/${id}`, { method: 'PUT', body: { status: 'canceled' } });
  }
}

export const mercadoPago: Pasarela = {
  nombre: 'mercadopago',

  async contratar({ org, empresa, plan, periodo, email, actual, volver }) {
    const monto = precioDe(plan, periodo);
    if (monto === null) return { error: 'Ese plan se cotiza aparte: escribinos.' };
    const vigente = actual.proveedor === 'mercadopago' ? actual.proveedor_suscripcion : null;

    // Ya paga con Mercado Pago y no cambia el período: se cambia el monto de la misma suscripción (rige desde el
    // próximo cobro) y el tope de unidades del plan nuevo, ya mismo.
    if (vigente && actual.estado !== 'cancelada' && actual.periodo === periodo) {
      try {
        await pedir(`/preapproval/${vigente}`, {
          method: 'PUT',
          body: { reason: motivo(plan, periodo, empresa), external_reference: referencia(org, plan.clave, periodo), auto_recurring: { transaction_amount: monto, currency_id: 'ARS' } },
        });
      } catch (e) {
        console.error('[mercadopago] cambio de plan', e);
        return { error: 'Mercado Pago no aceptó el cambio de plan. Probá de nuevo en unos minutos.' };
      }
      const { error } = await guardarSuscripcion({
        org, plan: plan.clave, periodo, estado: actual.estado === 'pago_pendiente' ? 'pago_pendiente' : 'activa', precio: monto,
        proveedor: 'mercadopago', proveedorSuscripcion: vigente, periodoHasta: null, cancelarAlTerminar: false, pagador: null,
      });
      return error ? { error: 'El cambio quedó hecho en Mercado Pago, pero no pudimos anotarlo acá. Escribinos.' } : { url: `${volver}?ok=plan-activo` };
    }

    // Suscripción nueva: la persona va a Mercado Pago, carga la tarjeta y autoriza los cobros. El email tiene que ser
    // el de la cuenta de Mercado Pago con la que paga: si no coincide, Mercado Pago rechaza el pago.
    try {
      const nueva = await pedir<Preaprobacion>('/preapproval', {
        method: 'POST',
        body: {
          reason: motivo(plan, periodo, empresa),
          external_reference: referencia(org, plan.clave, periodo, vigente),
          payer_email: email,
          back_url: `${volver}/volver`,
          status: 'pending',
          auto_recurring: { frequency: periodo === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: monto, currency_id: 'ARS' },
        },
      });
      if (!nueva.init_point) throw new Error('Mercado Pago no devolvió el enlace de pago');
      // Con el número en la dirección de vuelta, al volver se consulta esta suscripción sin esperar el aviso.
      await pedir(`/preapproval/${nueva.id}`, { method: 'PUT', body: { back_url: `${volver}/volver?id=${nueva.id}` } })
        .catch((e) => console.error('[mercadopago] dirección de vuelta', e));
      return { url: nueva.init_point };
    } catch (e) {
      console.error('[mercadopago] alta', e);
      if (e instanceof ErrorDeMercadoPago && e.estado === 400) {
        return { error: 'Mercado Pago no aceptó los datos. Revisá que el email sea el de tu cuenta de Mercado Pago y probá de nuevo.' };
      }
      return { error: 'No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.' };
    }
  },

  async cancelar({ org, actual }) {
    if (actual.proveedor === 'mercadopago' && actual.proveedor_suscripcion) {
      try {
        await darDeBaja(actual.proveedor_suscripcion);
      } catch (e) {
        console.error('[mercadopago] baja', e);
        return { error: 'Mercado Pago no aceptó la baja. Probá de nuevo en unos minutos.' };
      }
    }
    const { error } = await guardarSuscripcion({
      org, plan: actual.plan, periodo: actual.periodo, estado: 'cancelada', precio: actual.precio, proveedor: actual.proveedor ?? 'mercadopago',
      proveedorSuscripcion: actual.proveedor_suscripcion, periodoHasta: null, cancelarAlTerminar: true, pagador: null,
    });
    return error ? { error: 'La baja quedó hecha en Mercado Pago, pero no pudimos anotarla acá. Escribinos.' } : {};
  },
};

// Aviso de Mercado Pago: nunca se confía en lo que trae; se consulta el recurso en la API y se anota en la base.
export async function procesarAviso(tipo: string, recurso: string) {
  if (tipo === 'subscription_preapproval') return aplicarSuscripcion(await pedir<Preaprobacion>(`/preapproval/${recurso}`));
  if (tipo === 'subscription_authorized_payment') return aplicarCuota(await pedir<PagoAutorizado>(`/authorized_payments/${recurso}`));
  // Un pago: si es el cobro de una cuota, se anota esa cuota.
  if (tipo === 'payment') {
    const { results } = await pedir<{ results?: PagoAutorizado[] }>(`/authorized_payments/search?payment_id=${recurso}`);
    for (const cuota of results ?? []) await aplicarCuota(cuota);
  }
}

// Al volver de pagar: se consulta la suscripción y se anota ya, sin esperar el aviso. true si quedó activa.
export async function revisarAlVolver(org: string, id: string) {
  const suscripcion = await pedir<Preaprobacion>(`/preapproval/${id}`);
  if (leerReferencia(suscripcion.external_reference)?.org !== org) return false;
  await aplicarSuscripcion(suscripcion);
  return estadoDeSuscripcion(suscripcion.status) === 'activa';
}

async function aplicarSuscripcion(p: Preaprobacion) {
  const ref = leerReferencia(p.external_reference);
  const estado = estadoDeSuscripcion(p.status);
  if (!ref || !estado) return; // pendiente: todavía no autorizó el pago
  const { reemplazada, error } = await guardarSuscripcion({
    org: ref.org, plan: ref.plan, periodo: ref.periodo, estado, precio: p.auto_recurring?.transaction_amount ?? null,
    proveedor: 'mercadopago', proveedorSuscripcion: p.id, periodoHasta: estado === 'activa' ? p.next_payment_date ?? null : null,
    cancelarAlTerminar: estado === 'cancelada', pagador: p.payer_email || null,
  });
  if (error) throw new Error(`No se pudo anotar la suscripción: ${error.message}`);
  // Con la nueva autorizada, deja de cobrar la que reemplaza: la que figuraba al contratar y la que estaba vigente.
  if (estado === 'activa') {
    for (const id of new Set([ref.anterior, reemplazada])) if (id && id !== p.id) await darDeBaja(id);
  }
}

async function aplicarCuota(cuota: PagoAutorizado) {
  const estado = estadoDeCobro(cuota);
  if (!estado) return; // programada o en curso: todavía no hay resultado
  const suscripcion = await pedir<Preaprobacion>(`/preapproval/${cuota.preapproval_id}`);
  const ref = leerReferencia(suscripcion.external_reference);
  if (!ref) return;
  // Por si el aviso de la suscripción se demoró o se perdió, la cuota se anota con su suscripción al día.
  await aplicarSuscripcion(suscripcion);
  const { error } = await guardarCobro({
    org: ref.org, proveedor: 'mercadopago', proveedorPago: String(cuota.id), proveedorSuscripcion: suscripcion.id, estado,
    monto: cuota.transaction_amount, fecha: cuota.debit_date ?? cuota.date_created ?? null, cubreHasta: suscripcion.next_payment_date ?? null,
    detalle: cuota.reason ?? 'Tallerflota',
  });
  if (error) throw new Error(`No se pudo anotar el cobro: ${error.message}`);
}
