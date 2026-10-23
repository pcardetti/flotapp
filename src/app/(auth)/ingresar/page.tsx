import type { Metadata } from 'next';
import Link from 'next/link';
import { Aviso, ConfigPendiente } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { FormularioAcceso } from '../formulario-acceso';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string; aviso?: string }> }) {
  const { siguiente, error, aviso } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Ingresar</h1>
        <p className="text-ink-2">Entrá con el mail y la contraseña de tu cuenta.</p>
      </div>
      {!supabaseConfigurado() && <ConfigPendiente />}
      {error === 'enlace' && (
        <Aviso tipo="error">El enlace del mail venció o ya se usó. Si ya confirmaste tu mail, ingresá con tu contraseña; si no, registrate de nuevo.</Aviso>
      )}
      {aviso === 'confirmado' && <Aviso tipo="ok">Tu mail quedó confirmado. Ingresá con tu mail y tu contraseña.</Aviso>}
      <FormularioAcceso modo="ingresar" siguiente={siguiente} />
      <p className="text-sm text-ink-2">
        ¿No tenés cuenta? <Link className="font-semibold text-accent hover:underline" href={siguiente ? `/registrarse?siguiente=${encodeURIComponent(siguiente)}` : '/registrarse'}>Creá una</Link>
      </p>
    </>
  );
}
