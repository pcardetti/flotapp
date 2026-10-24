import { cache } from 'react';
import type { Periodo, Plan } from '@/lib/planes';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

// Estado de la cuenta de una empresa (ver cuenta_de en la migración 0006):
// libre (talleres y recapadoras), prueba, activa, gracia (cobro rechazado, todavía se carga) o solo_lectura.
export type Cuenta = 'libre' | 'prueba' | 'activa' | 'gracia' | 'solo_lectura';

export type Suscripcion = {
  plan: string;
  nombre_plan: string;
  max_unidades: number | null;
  unidades: number;
  estado: 'prueba' | 'activa' | 'pago_pendiente' | 'cancelada' | 'vencida';
  cuenta: Cuenta;
  periodo: Periodo;
  precio: number | null;
  prueba_hasta: string | null;
  periodo_hasta: string | null;
  gracia_hasta: string | null;
  cancelar_al_terminar: boolean;
  proveedor: 'manual' | 'mercadopago' | null;
  proveedor_suscripcion: string | null;
  pagos: { fecha: string; monto: number; estado: 'aprobado' | 'rechazado' | 'pendiente' | 'devuelto'; detalle: string | null }[];
};

// null si la base todavía no tiene la migración 0006 (ahí todo sigue como antes).
export const cuentaDe = cache(async (org: string): Promise<Cuenta | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('estado_cuenta', { p_org: org });
  if (error) {
    if (error.code !== 'PGRST202') avisarError('cuentaDe', error);
    return null;
  }
  return (data as Cuenta | null) ?? null;
});

// Sólo para administradores (la base devuelve null a los demás roles).
export async function suscripcionDe(org: string): Promise<Suscripcion | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('mi_suscripcion', { p_org: org });
  if (error && error.code !== 'PGRST202') avisarError('suscripcionDe', error);
  return (data as Suscripcion | null) ?? null;
}

export async function planesPublicos(): Promise<Plan[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('planes').select('clave, nombre, max_unidades, precio_mensual, precio_anual, bajada').order('orden');
  if (error && error.code !== 'PGRST205') avisarError('planesPublicos', error);
  return (data as Plan[] | null) ?? [];
}
