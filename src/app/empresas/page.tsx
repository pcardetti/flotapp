import { LayoutDashboard, Route, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotonLink, Marca } from '@/components/ui';
import { appDeRol, inicioDe } from '@/lib/apps';
import { NOMBRE_ROL, NOMBRE_TIPO, misEmpresas } from '@/lib/empresa';
import { usuarioActual } from '@/lib/supabase/server';
import { salir } from '../(auth)/acciones';

export const metadata: Metadata = { title: 'Mis empresas' };

const APP = {
  flota: { icono: LayoutDashboard, texto: 'Tallerflota' },
  chofer: { icono: Route, texto: 'App Chofer' },
  taller: { icono: Wrench, texto: 'App Taller' },
};

export default async function MisEmpresas() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar?siguiente=/empresas');
  const empresas = await misEmpresas();
  if (empresas.length === 0) redirect('/empresa/nueva');
  // Con una sola empresa, cada rol va directo a su app.
  if (empresas.length === 1) redirect(inicioDe(empresas[0]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+28px)]">
      <header className="flex items-center justify-between gap-4">
        <Marca chica />
        <form action={salir}><button className="text-sm font-semibold text-ink-2 hover:underline">Salir</button></form>
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">¿Dónde entrás?</h1>
        <p className="text-ink-2">Entraste como {usuario.email}.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {empresas.map((m) => {
          const app = APP[appDeRol(m)];
          return (
            <li key={m.organizacion.id}>
              <Link href={inicioDe(m)} transitionTypes={['nav-forward']} className="tap flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 hover:border-ink-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-ink"><app.icono className="size-5" /></span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-lg">{m.organizacion.nombre}</b>
                  <span className="text-sm text-ink-3">{NOMBRE_TIPO[m.organizacion.tipo]} · {NOMBRE_ROL[m.rol]} · {app.texto}</span>
                </span>
                <span aria-hidden className="text-ink-3">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div><BotonLink href="/empresa/nueva" variante="secundario">Dar de alta otra empresa</BotonLink></div>
    </main>
  );
}
