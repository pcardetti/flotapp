import { modoDemo } from '@/lib/demo/activo';
import type { Periodo, Plan } from '@/lib/planes';
import type { Suscripcion } from '@/lib/suscripcion';
import { mercadoPago, mercadoPagoConfigurado } from './mercadopago';
import { simulador } from './simulador';

export type Contratacion = {
  org: string;
  empresa: string;
  plan: Plan;
  periodo: Periodo;
  email: string; // el de la cuenta de Mercado Pago con la que se paga
  actual: Suscripcion;
  volver: string; // adónde vuelve la persona después de pagar
};

// Lo que hace cualquier pasarela de pago. Contratar devuelve adónde mandar a la persona (el pago en la
// pasarela, o de vuelta a la app si el cambio no necesita pasar por caja).
export type Pasarela = {
  nombre: 'mercadopago' | 'simulador';
  contratar(c: Contratacion): Promise<{ url: string } | { error: string }>;
  cancelar(c: { org: string; actual: Suscripcion }): Promise<{ error?: string }>;
};

// Mercado Pago si tiene credenciales; en el modo demo, un simulador que aprueba todo; si no, no hay cobro en línea.
export function pasarela(): Pasarela | null {
  if (mercadoPagoConfigurado()) return mercadoPago;
  if (modoDemo()) return simulador;
  return null;
}
