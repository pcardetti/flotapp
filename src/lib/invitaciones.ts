import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export type VistaInvitacion = { empresa: string; tipo: string; rol: string; nombre: string | null; estado: 'vigente' | 'usada' | 'vencida' | 'revocada' };

// "/invitacion/<token>" → el token, si la dirección de vuelta es una invitación.
export const tokenDeInvitacion = (ruta: unknown) => (typeof ruta === 'string' ? /^\/invitacion\/([0-9a-f]{64})$/.exec(ruta)?.[1] ?? null : null);

// Lo mínimo de una invitación (empresa, rol, si sigue vigente); se puede ver sin haber iniciado sesión.
export async function verInvitacion(token: string): Promise<VistaInvitacion | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('ver_invitacion', { p_token: token });
  avisarError('verInvitacion', error);
  return (data ?? null) as VistaInvitacion | null;
}

// Cada rol empieza en su app.
const inicioDeRol = (rol: string, org: string) => (rol === 'chofer' ? '/chofer?ok=bienvenida' : rol === 'mecanico' ? '/taller' : `/empresa/${org}/panel`);

// Acepta la invitación con la sesión de ese cliente: sirve también recién creada la cuenta o recién ingresado,
// en el mismo pedido. Devuelve a dónde entrar, o el motivo si no se pudo.
export async function aceptarInvitacionCon(supabase: Cliente, token: string): Promise<{ destino: string } | { error: string }> {
  const { data, error } = await supabase.rpc('aceptar_invitacion', { p_token: token });
  if (error) {
    avisarError('aceptarInvitacion', error);
    return { error: /^La invitación/.test(error.message) ? error.message : 'No pudimos aceptar la invitación. Probá de nuevo en unos segundos.' };
  }
  const { organizacion_id: org, rol } = data as { organizacion_id: string; rol: string };
  return { destino: inicioDeRol(rol, org) };
}
