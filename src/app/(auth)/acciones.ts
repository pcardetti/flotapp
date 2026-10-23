'use server';

import { redirect } from 'next/navigation';
import { aceptarInvitacionCon, tokenDeInvitacion } from '@/lib/invitaciones';
import { rutaInterna } from '@/lib/rutas';
import { crearClienteServidor } from '@/lib/supabase/server';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { urlBase } from '@/lib/url';

export type EstadoForm = { error?: string; ok?: string; email?: string };

// Sólo rutas internas: evita que un enlace manipulado mande al usuario a otro sitio.
const destinoSeguro = (s: FormDataEntryValue | null) => rutaInterna(s);

// Con sesión recién abierta: si se llegó desde una invitación (empresa y rol a la vista en el formulario),
// se acepta en el mismo paso y se entra directo a la app del rol. Si no se puede, la invitación explica por qué.
async function entrar(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, siguiente: FormDataEntryValue | null): Promise<never> {
  const token = tokenDeInvitacion(siguiente);
  if (token) {
    const r = await aceptarInvitacionCon(supabase, token);
    redirect('destino' in r ? r.destino : `/invitacion/${token}`);
  }
  redirect(destinoSeguro(siguiente));
}

function traducir(error: { code?: string; message: string }) {
  switch (error.code) {
    case 'invalid_credentials':
      return 'El mail o la contraseña no coinciden.';
    case 'email_not_confirmed':
      return 'Todavía no confirmaste tu mail. Buscá el correo que te mandamos y tocá el enlace.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya hay una cuenta con ese mail. Ingresá con tu contraseña.';
    case 'weak_password':
      return 'La contraseña es muy fácil de adivinar. Usá al menos 8 caracteres combinando letras y números.';
    case 'signup_disabled':
      return 'Por ahora no se pueden crear cuentas nuevas.';
    case 'email_address_not_authorized':
      return 'No pudimos mandar el mail de confirmación a esa dirección. Probá con otro mail.';
    case 'over_email_send_rate_limit':
      return 'Se mandaron demasiados mails en poco tiempo. Esperá un rato y probá de nuevo.';
    case 'over_request_rate_limit':
      return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
  }
  if (/password should be at least/i.test(error.message)) return 'La contraseña tiene que tener al menos 8 caracteres.';
  return 'No pudimos completar el pedido. Probá de nuevo en unos minutos.';
}

export async function ingresar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!supabaseConfigurado()) return { error: 'La app todavía no está conectada a la base de datos.' };
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Completá el mail y la contraseña.', email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traducir(error), email };
  return entrar(supabase, form.get('siguiente'));
}

export async function registrarse(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!supabaseConfigurado()) return { error: 'La app todavía no está conectada a la base de datos.' };
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Completá el mail y la contraseña.', email };
  if (password.length < 8) return { error: 'La contraseña tiene que tener al menos 8 caracteres.', email };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Después de confirmar el mail vuelve a donde estaba (por ejemplo, a aceptar una invitación).
    options: { emailRedirectTo: `${await urlBase()}/auth/confirmar?siguiente=${encodeURIComponent(destinoSeguro(form.get('siguiente')))}` },
  });
  if (error) return { error: traducir(error), email };
  // Con la confirmación activada, Supabase no avisa que el mail ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) return { error: 'Ya hay una cuenta con ese mail. Ingresá con tu contraseña.', email };
  // Sin confirmación por mail, Supabase ya devuelve la sesión: se entra en el momento.
  if (data.session) return entrar(supabase, form.get('siguiente'));
  return { ok: `Te mandamos un mail a ${email}. Tocá el enlace para confirmar tu cuenta y seguir.`, email };
}

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/ingresar');
}
