import { precioDe } from '@/lib/planes';
import { guardarCobro, guardarSuscripcion } from './base';
import type { Pasarela } from './index';

// Pasarela de mentira para el modo demo: aprueba el pago al instante y vuelve a la app.
const enUnPeriodo = (periodo: 'mensual' | 'anual') => {
  const d = new Date();
  d.setMonth(d.getMonth() + (periodo === 'anual' ? 12 : 1));
  return d.toISOString();
};

export const simulador: Pasarela = {
  nombre: 'simulador',
  async contratar({ org, plan, periodo, email, volver }) {
    const precio = precioDe(plan, periodo);
    const hasta = enUnPeriodo(periodo);
    const { error } = await guardarSuscripcion({
      org, plan: plan.clave, periodo, estado: 'activa', precio, proveedor: 'manual',
      proveedorSuscripcion: null, periodoHasta: hasta, cancelarAlTerminar: false, pagador: email,
    });
    if (error) return { error: 'No pudimos activar el plan. Probá de nuevo en unos segundos.' };
    await guardarCobro({
      org, proveedor: 'simulador', proveedorPago: `demo-${Date.now()}`, proveedorSuscripcion: null, estado: 'aprobado', monto: precio ?? 0,
      fecha: new Date().toISOString(), cubreHasta: hasta, detalle: `Plan ${plan.nombre} (${periodo})`,
    });
    return { url: `${volver}?ok=plan-activo` };
  },
  async cancelar({ org, actual }) {
    const { error } = await guardarSuscripcion({
      org, plan: actual.plan, periodo: actual.periodo, estado: 'cancelada', precio: actual.precio, proveedor: 'manual',
      proveedorSuscripcion: null, periodoHasta: actual.periodo_hasta, cancelarAlTerminar: true, pagador: null,
    });
    return error ? { error: 'No pudimos dar de baja el plan. Probá de nuevo en unos segundos.' } : {};
  },
};
