'use client';

import { useActionState } from 'react';
import { aceptarInvitacion } from './acciones';

export function BotonAceptar({ token }: { token: string }) {
  const [estado, enviar, enviando] = useActionState(aceptarInvitacion.bind(null, token), {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <button disabled={enviando} className="tap flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink shadow-tarjeta disabled:opacity-60">
        {enviando ? 'Sumándote…' : 'Aceptar y entrar'}
      </button>
      {estado.error && <p role="alert" className="rounded-2xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">{estado.error}</p>}
    </form>
  );
}
