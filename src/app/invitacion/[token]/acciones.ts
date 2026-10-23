'use server';

import { redirect } from 'next/navigation';
import { aceptarInvitacionCon } from '@/lib/invitaciones';
import { crearClienteServidor, usuarioActual } from '@/lib/supabase/server';

export async function aceptarInvitacion(token: string, _: { error?: string }): Promise<{ error?: string }> {
  if (!(await usuarioActual())) redirect(`/ingresar?siguiente=/invitacion/${token}`);
  const r = await aceptarInvitacionCon(await crearClienteServidor(), token);
  if ('error' in r) return r;
  redirect(r.destino);
}
