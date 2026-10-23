import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotonLink, Marca } from '@/components/ui';
import { NOMBRE_ROL, NOMBRE_TIPO, misEmpresas } from '@/lib/empresa';
import { usuarioActual } from '@/lib/supabase/server';
import { salir } from '../(auth)/acciones';

export const metadata: Metadata = { title: 'Mis empresas' };

export default async function MisEmpresas() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar?siguiente=/empresas');
  const empresas = await misEmpresas();
  if (empresas.length === 0) redirect('/empresa/nueva');
  if (empresas.length === 1) redirect(`/empresa/${empresas[0].organizacion.id}/panel`);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Marca chica />
        <form action={salir}><button className="text-sm font-semibold text-ink-2 hover:underline">Salir</button></form>
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Elegí una empresa</h1>
        <p className="text-ink-2">Entraste como {usuario.email}.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {empresas.map(({ organizacion, rol }) => (
          <li key={organizacion.id}>
            <Link href={`/empresa/${organizacion.id}/panel`} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4 hover:border-ink-3">
              <span className="flex flex-col">
                <b className="text-lg">{organizacion.nombre}</b>
                <span className="text-sm text-ink-3">{NOMBRE_TIPO[organizacion.tipo]} · {NOMBRE_ROL[rol]}</span>
              </span>
              <span aria-hidden className="text-ink-3">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <div><BotonLink href="/empresa/nueva" variante="secundario">Dar de alta otra empresa</BotonLink></div>
    </main>
  );
}
