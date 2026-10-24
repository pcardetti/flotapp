// Cómo se leen las suscripciones y los cobros de Mercado Pago (sin dependencias, para probarlo aparte).

// Una suscripción ("preapproval"). La documentación escribe "canceled" y los SDK oficiales "cancelled": valen las dos.
export type Preaprobacion = {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | 'canceled';
  external_reference: string | null;
  payer_email?: string | null;
  init_point?: string;
  next_payment_date?: string | null;
  auto_recurring?: { frequency: number; frequency_type: string; transaction_amount: number; currency_id: string };
};

// Una cuota de la suscripción ("authorized_payment"): scheduled, recycling (rechazada, se reintenta), processed
// (cobrada o sin más reintentos) o canceled. El resultado del cobro está en payment.status.
export type PagoAutorizado = {
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount: number;
  date_created?: string;
  debit_date?: string;
  reason?: string;
  payment?: { id: number | string; status: string; status_detail?: string } | null;
};

export const estaCancelada = (status: string) => status === 'cancelled' || status === 'canceled';

// Autorizada: activa. Pausada o cancelada: no cobra más, así que sigue hasta el fin del período pago.
// Pendiente: todavía no cargó la tarjeta, no cambia nada.
export function estadoDeSuscripcion(status: string): 'activa' | 'cancelada' | null {
  if (status === 'authorized') return 'activa';
  if (status === 'paused' || estaCancelada(status)) return 'cancelada';
  return null;
}

// null: programada o en curso, todavía no hay resultado.
export function estadoDeCobro(pago: Pick<PagoAutorizado, 'status' | 'payment'>): 'aprobado' | 'rechazado' | 'devuelto' | null {
  const resultado = pago.payment?.status;
  if (resultado === 'approved') return 'aprobado';
  if (resultado === 'refunded' || resultado === 'charged_back') return 'devuelto';
  if (resultado === 'rejected' || pago.status === 'recycling') return 'rechazado';
  return null;
}
