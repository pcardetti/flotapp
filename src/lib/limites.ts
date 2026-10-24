import { createHash, createHmac } from 'node:crypto';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

// Límite de intentos de ingreso, registro y pedidos de contratación, contado en la base (consumir_intento). Hace
// falta porque todo sale del servidor: Supabase ve siempre la IP de Vercel y su propio límite no distingue personas.
type Accion = 'ingresar_mail' | 'ingresar_ip' | 'registro_ip' | 'contacto_ip';

// Clave opaca. Con el secreto propio de la app, quien llame a la base directo no puede calcular la de otra
// persona para trabarle el ingreso; sin el secreto el límite igual funciona, pero esa protección se pierde.
function clave(accion: Accion, valor: string) {
  const texto = `${accion}:${valor.trim().toLowerCase()}`;
  const secreto = process.env.FLOTAPP_SECRETO_LIMITES;
  return secreto ? createHmac('sha256', secreto).update(texto).digest('hex') : createHash('sha256').update(texto).digest('hex');
}

// true si todavía se puede intentar. Si la base no responde (o falta la migración) no traba el acceso.
export async function permitirIntento(accion: Accion, valor: string) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('consumir_intento', { p_accion: accion, p_clave: clave(accion, valor) });
  if (error) {
    avisarError('limite', error);
    return true;
  }
  return data !== false;
}
