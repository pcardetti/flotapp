'use server';

import { permitirIntento } from '@/lib/limites';
import { ipCliente } from '@/lib/peticion';
import { MAX_UNIDADES, planPara } from '@/lib/planes';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { planesPublicos } from '@/lib/suscripcion';

export type EstadoPedido = {
  ok?: { nombre: string; empresa: string; plan: string; unidades: number };
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
};

const texto = (form: FormData, campo: string, largo: number) => String(form.get(campo) ?? '').trim().replace(/\s+/g, ' ').slice(0, largo);

// Pedido de contratación desde la página de inicio. Queda guardado en la base (tabla solicitudes) para
// contactar a la empresa, coordinar el pago y darla de alta.
export async function solicitarContratacion(_: EstadoPedido, form: FormData): Promise<EstadoPedido> {
  const valores = {
    empresa: texto(form, 'empresa', 120),
    nombre: texto(form, 'nombre', 80),
    email: texto(form, 'email', 160).toLowerCase(),
    telefono: texto(form, 'telefono', 30),
    unidades: texto(form, 'unidades', 6),
    comentario: String(form.get('comentario') ?? '').trim().slice(0, 1000),
  };
  const unidades = Number(valores.unidades);
  const planes = await planesPublicos();
  const nombrePlan = (u: number) => (planes.length ? planPara(planes, u).nombre : 'a definir');
  const respuesta = (u: number) => ({ ok: { nombre: valores.nombre, empresa: valores.empresa, plan: nombrePlan(u), unidades: u } });
  // Campo trampa, invisible para las personas: si llega lleno lo completó un robot, y se le contesta como si nada.
  if (form.get('sitio_web')) return respuesta(Number.isInteger(unidades) && unidades > 0 ? unidades : 1);

  const errores: Record<string, string> = {};
  if (valores.empresa.length < 2) errores.empresa = 'Escribí el nombre de la empresa.';
  if (valores.nombre.length < 2) errores.nombre = 'Escribí tu nombre.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valores.email)) errores.email = 'Revisá el mail, por ejemplo nombre@empresa.com.';
  if ((valores.telefono.match(/\d/g) ?? []).length < 8 || /[^\d\s()+-]/.test(valores.telefono)) {
    errores.telefono = 'Escribí un WhatsApp con la característica, por ejemplo 11 5555 0102.';
  }
  if (!Number.isInteger(unidades) || unidades < 1 || unidades > MAX_UNIDADES) errores.unidades = 'Escribí cuántas unidades tiene la flota.';
  if (Object.keys(errores).length) return { errores, valores };

  if (!(await permitirIntento('contacto_ip', await ipCliente()))) {
    return { error: 'Recibimos muchos pedidos desde esta conexión. Probá de nuevo en una hora.', valores };
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('solicitar_contratacion', {
    p_empresa: valores.empresa,
    p_nombre: valores.nombre,
    p_email: valores.email,
    p_telefono: valores.telefono,
    p_unidades: unidades,
    p_plan: planes.length ? planPara(planes, unidades).clave : 'a-definir',
    p_comentario: valores.comentario,
  });
  if (error) {
    avisarError('solicitarContratacion', error);
    return { error: 'No pudimos enviar el pedido. Probá de nuevo en unos minutos.', valores };
  }
  return respuesta(unidades);
}
