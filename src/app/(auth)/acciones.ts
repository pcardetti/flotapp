'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { supabaseConfigurado } from '@/lib/supabase/config';

export type EstadoForm = { error?: string; ok?: string; email?: string };

// Sólo rutas internas: evita que un enlace manipulado mande al usuario a otro sitio.
const destinoSeguro = (s: FormDataEntryValue | null) => {
  const d = typeof s === 'string' ? s : '';
  return d.startsWith('/') && !d.startsWith('//') ? d : '/empresas';
};

// En Vercel la dirección sale del pedido; una NEXT_PUBLIC_SITE_URL de localhost copiada por error se ignora.
async function urlBase() {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL;
  if (sitio && !(process.env.VERCEL && /localhost|127\.0\.0\.1/.test(sitio))) return sitio.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
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
  redirect(destinoSeguro(form.get('siguiente')));
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
    options: { emailRedirectTo: `${await urlBase()}/auth/confirmar?siguiente=/empresas` },
  });
  if (error) return { error: traducir(error), email };
  // Con la confirmación activada, Supabase no avisa que el mail ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) return { error: 'Ya hay una cuenta con ese mail. Ingresá con tu contraseña.', email };
  if (data.session) redirect('/empresas');
  return { ok: `Te mandamos un mail a ${email}. Tocá el enlace para confirmar tu cuenta y seguir.`, email };
}

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/ingresar');
}
