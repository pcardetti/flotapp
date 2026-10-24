import { randomUUID } from 'node:crypto';
import { UUID } from '@/lib/empresa';
import { precioDe, type Periodo, type Plan } from '@/lib/planes';
import { guardarCobro, guardarSuscripcion, type EstadoCobro, type EstadoSuscripcion } from './base';
import type { Pasarela } from './index';

// Mercado Pago Suscripciones ("sin plan asociado"): cada flota tiene una preaprobación de cobro recurrente con su
// monto y período. Se crea pendiente y la persona la autoriza en Mercado Pago con su tarjeta; desde ahí los cobros
// son automáticos y cada novedad llega como aviso (api/pagos/mercadopago).
// Variables (sólo servidor): MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y FLOTAPP_SECRETO_PAGOS.

const API = 'https://api.mercadopago.com';

export const mercadoPagoConfigurado = () => Boolean(process.env.MP_ACCESS_TOKEN && process.env.FLOTAPP_SECRETO_PAGOS);

type Preaprobacion = {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference: string | null;
  payer_email?: string | null;
  init_point?: string;
  next_payment_date?: string | null;
  auto_recurring?: { frequency: number; frequency_type: string; transaction_amount: number; currency_id: string };
};

type PagoAutorizado = {
  id: number | string;
  preapproval_id: string;
  status: string; // scheduled, processed, recycling, cancelled
  transaction_amount: number;
  date_created?: string;
  debit_date?: string;
  reason?: string;
  payment?: { id: number | string; status: string } | null;
};

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
  });
  if (!respuesta.ok) throw new Error(`Mercado Pago ${respuesta.status} en ${ruta}: ${(await respuesta.text()).slice(0, 300)}`);
  return respuesta.json() as Promise<T>;
}

// La referencia externa lleva la empresa, el plan, el período y, al cambiar de período, la suscripción anterior
// (que se da de baja cuando la nueva queda autorizada). Así cada aviso sabe a quién aplicar.
const referencia = (org: string, plan: string, periodo: Periodo, anterior?: string | null) => [org, plan, periodo, anterior ?? ''].join('|');
function leerReferencia(texto: string | null) {
  const [org, plan, periodo, anterior] = (texto ?? '').split('|');
  if (!UUID.test(org ?? '') || !plan || (periodo !== 'mensual' && periodo !== 'anual')) return null;
  return { org, plan, periodo: periodo as Periodo, anterior: anterior || null };
}

const motivo = (plan: Plan, periodo: Periodo, empresa: string) => `Flotapp · Plan ${plan.nombre} (${periodo === 'anual' ? 'anual' : 'mensual'}) · ${empresa}`.slice(0, 120);

export const mercadoPago: Pasarela = {
  nombre: 'mercadopago',

  async contratar({ org, empresa, plan, periodo, email, actual, volver }) {
    const monto = precioDe(plan, periodo);
    if (monto === null) return { error: 'Ese plan se cotiza aparte: escribinos.' };

    // Ya paga con Mercado Pago y no cambia el período: se cambia el monto de la misma suscripción (rige desde el
    // próximo cobro) y el tope de unidades del plan nuevo, ya mismo.
    if (actual.proveedor === 'mercadopago' && actual.proveedor_suscripcion && actual.estado !== 'cancelada' && actual.periodo === periodo) {
      try {
        await pedir(`/preapproval/${actual.proveedor_suscripcion}`, {
          method: 'PUT',
          body: { reason: motivo(plan, periodo, empresa), external_reference: referencia(org, plan.clave, periodo), auto_recurring: { transaction_amount: monto, currency_id: 'ARS' } },
        });
      } catch (e) {
        console.error('[mercadopago] cambio de plan', e);
        return { error: 'Mercado Pago no aceptó el cambio de plan. Probá de nuevo en unos minutos.' };
      }
      const { error } = await guardarSuscripcion({
        org, plan: plan.clave, periodo, estado: actual.estado === 'pago_pendiente' ? 'pago_pendiente' : 'activa', precio: monto,
        proveedor: 'mercadopago', proveedorSuscripcion: actual.proveedor_suscripcion, periodoHasta: null, cancelarAlTerminar: false, pagador: null,
      });
      return error ? { error: 'El cambio quedó hecho en Mercado Pago, pero no pudimos anotarlo acá. Escribinos.' } : { url: `${volver}?ok=plan-activo` };
    }

    // Suscripción nueva: la persona va a Mercado Pago, carga la tarjeta y autoriza los cobros.
    const anterior = actual.proveedor === 'mercadopago' && actual.estado !== 'cancelada' ? actual.proveedor_suscripcion : null;
    try {
      const nueva = await pedir<Preaprobacion>('/preapproval', {
        method: 'POST',
        body: {
          reason: motivo(plan, periodo, empresa),
          external_reference: referencia(org, plan.clave, periodo, anterior),
          payer_email: email,
          back_url: `${volver}?ok=pago`,
          status: 'pending',
          auto_recurring: { frequency: periodo === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: monto, currency_id: 'ARS' },
        },
      });
      if (!nueva.init_point) throw new Error('Mercado Pago no devolvió el enlace de pago');
      return { url: nueva.init_point };
    } catch (e) {
      console.error('[mercadopago] alta', e);
      return { error: 'No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.' };
    }
  },

  async cancelar({ org, actual }) {
    if (actual.proveedor === 'mercadopago' && actual.proveedor_suscripcion) {
      try {
        await pedir(`/preapproval/${actual.proveedor_suscripcion}`, { method: 'PUT', body: { status: 'cancelled' } });
      } catch (e) {
        console.error('[mercadopago] baja', e);
        return { error: 'Mercado Pago no aceptó la baja. Probá de nuevo en unos minutos.' };
      }
    }
    const { error } = await guardarSuscripcion({
      org, plan: actual.plan, periodo: actual.periodo, estado: 'cancelada', precio: actual.precio, proveedor: 'mercadopago',
      proveedorSuscripcion: actual.proveedor_suscripcion, periodoHasta: null, cancelarAlTerminar: true, pagador: null,
    });
    return error ? { error: 'La baja quedó hecha en Mercado Pago, pero no pudimos anotarla acá. Escribinos.' } : {};
  },
};

// Aviso de Mercado Pago: nunca se confía en lo que trae; se consulta el recurso en la API y se anota en la base.
export async function procesarAviso(tipo: string, recurso: string) {
  if (tipo === 'subscription_preapproval') return aplicarPreaprobacion(await pedir<Preaprobacion>(`/preapproval/${recurso}`));
  if (tipo === 'subscription_authorized_payment') return aplicarCobro(await pedir<PagoAutorizado>(`/authorized_payments/${recurso}`));
}

const ESTADO_PREAPROBACION: Partial<Record<Preaprobacion['status'], EstadoSuscripcion>> = {
  authorized: 'activa',
  paused: 'pago_pendiente',
  cancelled: 'cancelada',
};

async function aplicarPreaprobacion(p: Preaprobacion) {
  const ref = leerReferencia(p.external_reference);
  const estado = ESTADO_PREAPROBACION[p.status];
  if (!ref || !estado) return; // pendiente: todavía no autorizó el pago
  const { error } = await guardarSuscripcion({
    org: ref.org, plan: ref.plan, periodo: ref.periodo, estado, precio: p.auto_recurring?.transaction_amount ?? null,
    proveedor: 'mercadopago', proveedorSuscripcion: p.id, periodoHasta: estado === 'activa' ? p.next_payment_date ?? null : null,
    cancelarAlTerminar: estado === 'cancelada', pagador: p.payer_email ?? null,
  });
  if (error) throw new Error(`No se pudo anotar la suscripción: ${error.message}`);
  // Cambio de período: con la nueva autorizada, la anterior deja de cobrar.
  if (estado === 'activa' && ref.anterior && ref.anterior !== p.id) {
    await pedir(`/preapproval/${ref.anterior}`, { method: 'PUT', body: { status: 'cancelled' } }).catch((e) => console.error('[mercadopago] baja de la anterior', e));
  }
}

async function aplicarCobro(pago: PagoAutorizado) {
  const estadoPago = pago.payment?.status;
  const estado: EstadoCobro | null =
    estadoPago === 'approved' ? 'aprobado'
    : estadoPago === 'refunded' || estadoPago === 'charged_back' ? 'devuelto'
    : estadoPago === 'rejected' || pago.status === 'recycling' ? 'rechazado'
    : null;
  if (!estado) return; // programado o en curso: todavía no hay resultado
  const suscripcion = await pedir<Preaprobacion>(`/preapproval/${pago.preapproval_id}`);
  const ref = leerReferencia(suscripcion.external_reference);
  if (!ref) return;
  const { error } = await guardarCobro({
    org: ref.org, proveedor: 'mercadopago', proveedorPago: String(pago.id), estado, monto: pago.transaction_amount,
    fecha: pago.debit_date ?? pago.date_created ?? null, cubreHasta: suscripcion.next_payment_date ?? null, detalle: pago.reason ?? 'Flotapp',
  });
  if (error) throw new Error(`No se pudo anotar el cobro: ${error.message}`);
}
