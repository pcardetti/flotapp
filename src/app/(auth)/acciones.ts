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

async function urlBase() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
}

function traducir(mensaje: string) {
  if (/invalid login credentials/i.test(mensaje)) return 'El mail o la contraseña no coinciden.';
  if (/email not confirmed/i.test(mensaje)) return 'Todavía no confirmaste tu mail. Buscá el correo que te mandamos y tocá el enlace.';
  if (/already registered|already exists/i.test(mensaje)) return 'Ya hay una cuenta con ese mail. Ingresá con tu contraseña.';
  if (/password should be at least/i.test(mensaje)) return 'La contraseña tiene que tener al menos 8 caracteres.';
  if (/rate limit/i.test(mensaje)) return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
  return 'No pudimos completar el pedido. Probá de nuevo en unos minutos.';
}

export async function ingresar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!supabaseConfigurado()) return { error: 'La app todavía no está conectada a la base de datos.' };
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Completá el mail y la contraseña.', email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traducir(error.message), email };
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
  if (error) return { error: traducir(error.message), email };
  if (data.session) redirect('/empresas');
  return { ok: `Te mandamos un mail a ${email}. Tocá el enlace para confirmar tu cuenta y seguir.`, email };
}

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/ingresar');
}
