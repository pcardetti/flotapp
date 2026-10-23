import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigPendiente } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { FormularioAcceso } from '../formulario-acceso';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Ingresar</h1>
        <p className="text-ink-2">Entrá con el mail y la contraseña de tu cuenta.</p>
      </div>
      {!supabaseConfigurado() && <ConfigPendiente />}
      {error === 'enlace' && (
        <p role="alert" className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
          El enlace del mail venció o ya se usó. Ingresá con tu contraseña o registrate de nuevo.
        </p>
      )}
      <FormularioAcceso modo="ingresar" siguiente={siguiente} />
      <p className="text-sm text-ink-2">
        ¿No tenés cuenta? <Link className="font-semibold text-accent hover:underline" href="/registrarse">Creá una</Link>
      </p>
    </>
  );
}
