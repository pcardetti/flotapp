'use server';

import { redirect } from 'next/navigation';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';

export async function aceptarInvitacion(token: string, _: { error?: string }): Promise<{ error?: string }> {
  if (!(await usuarioActual())) redirect(`/ingresar?siguiente=/invitacion/${token}`);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('aceptar_invitacion', { p_token: token });
  if (error) {
    avisarError('aceptarInvitacion', error);
    return { error: /^La invitación/.test(error.message) ? error.message : 'No pudimos aceptar la invitación. Probá de nuevo en unos segundos.' };
  }
  const { organizacion_id: org, rol } = data as { organizacion_id: string; rol: string };
  // Cada rol empieza en su app.
  redirect(rol === 'chofer' ? '/chofer?ok=bienvenida' : rol === 'mecanico' ? '/taller' : `/empresa/${org}/panel`);
}
