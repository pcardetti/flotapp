import type { Periodo } from '@/lib/planes';
import { crearClienteServidor } from '@/lib/supabase/server';

// Escrituras de facturación en la base. Sólo pasan con el secreto que comparten este servidor y la base
// (FLOTAPP_SECRETO_PAGOS, ver la migración 0006): la app nunca usa la llave maestra de Supabase.
const secreto = () => process.env.FLOTAPP_SECRETO_PAGOS ?? '';

export type EstadoSuscripcion = 'prueba' | 'activa' | 'pago_pendiente' | 'cancelada' | 'vencida';
export type EstadoCobro = 'aprobado' | 'rechazado' | 'pendiente' | 'devuelto';

// La base ignora la baja de una suscripción que ya no es la vigente. Devuelve la que quedó reemplazada por una
// nueva (hay que darla de baja en la pasarela), o null.
export async function guardarSuscripcion(s: {
  org: string;
  plan: string;
  periodo: Periodo;
  estado: EstadoSuscripcion;
  precio: number | null;
  proveedor: 'manual' | 'mercadopago';
  proveedorSuscripcion: string | null;
  periodoHasta: string | null;
  cancelarAlTerminar: boolean;
  pagador: string | null;
}) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('pagos_actualizar_suscripcion', {
    p_secreto: secreto(),
    p_org: s.org,
    p_plan: s.plan,
    p_periodo: s.periodo,
    p_estado: s.estado,
    p_precio: s.precio,
    p_proveedor: s.proveedor,
    p_proveedor_suscripcion: s.proveedorSuscripcion,
    p_periodo_hasta: s.periodoHasta,
    p_cancelar_al_terminar: s.cancelarAlTerminar,
    p_pagador: s.pagador,
  });
  return { reemplazada: (data as string | null) ?? null, error };
}

export async function guardarCobro(c: {
  org: string;
  proveedor: string;
  proveedorPago: string;
  proveedorSuscripcion: string | null; // la suscripción a la que pertenece el cobro
  estado: EstadoCobro;
  monto: number;
  fecha: string | null;
  cubreHasta: string | null;
  detalle: string;
}) {
  const supabase = await crearClienteServidor();
  return supabase.rpc('pagos_registrar_cobro', {
    p_secreto: secreto(),
    p_org: c.org,
    p_proveedor: c.proveedor,
    p_proveedor_pago: c.proveedorPago,
    p_proveedor_suscripcion: c.proveedorSuscripcion,
    p_estado: c.estado,
    p_monto: c.monto,
    p_fecha: c.fecha,
    p_cubre_hasta: c.cubreHasta,
    p_detalle: c.detalle,
  });
}

// true: hay que procesar el aviso; false: ya se procesó antes; null: la base no respondió (que la pasarela reintente).
export async function recibirEvento(e: { proveedor: string; evento: string; tipo: string; recurso: string | null }) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('pagos_recibir_evento', {
    p_secreto: secreto(),
    p_proveedor: e.proveedor,
    p_evento: e.evento,
    p_tipo: e.tipo,
    p_recurso: e.recurso,
  });
  return error ? null : data === true;
}

export async function cerrarEvento(e: { proveedor: string; evento: string; error?: string }) {
  const supabase = await crearClienteServidor();
  return supabase.rpc('pagos_cerrar_evento', { p_secreto: secreto(), p_proveedor: e.proveedor, p_evento: e.evento, p_error: e.error ?? null });
}
