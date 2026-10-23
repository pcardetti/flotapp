import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigPendiente } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { FormularioAcceso } from '../formulario-acceso';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function Registrarse() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Crear cuenta</h1>
        <p className="text-ink-2">Después de confirmar tu mail, das de alta tu empresa: una flota, un taller o una recapadora.</p>
      </div>
      {!supabaseConfigurado() && <ConfigPendiente />}
      <FormularioAcceso modo="registrarse" />
      <p className="text-sm text-ink-2">
        ¿Ya tenés cuenta? <Link className="font-semibold text-accent hover:underline" href="/ingresar">Ingresá</Link>
      </p>
    </>
  );
}
