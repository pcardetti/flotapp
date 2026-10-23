import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ConfigPendiente } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { FormularioAcceso } from '../formulario-acceso';
import { invitacionVigente, TarjetaInvitado } from '../invitado';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function Registrarse({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  const inv = supabaseConfigurado() ? await invitacionVigente(siguiente) : null;
  // Nonce de la política de contenido: lo usa el script de Turnstile.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Crear cuenta</h1>
        <p className="text-ink-2">
          {inv ? 'Con tu mail y una contraseña.' : 'Con tu cuenta das de alta tu empresa: una flota, un taller o una recapadora.'}
        </p>
      </div>
      {!supabaseConfigurado() && <ConfigPendiente />}
      {inv && <TarjetaInvitado inv={inv} accion="Al crear tu cuenta quedás adentro." />}
      <FormularioAcceso modo="registrarse" siguiente={siguiente} nonce={nonce} boton={inv ? 'Crear cuenta y sumarme' : undefined} />
      <p className="text-sm text-ink-2">
        ¿Ya tenés cuenta? <Link className="font-semibold text-accent hover:underline" href={siguiente ? `/ingresar?siguiente=${encodeURIComponent(siguiente)}` : '/ingresar'}>Ingresá</Link>
      </p>
    </>
  );
}
