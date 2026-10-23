import Link from 'next/link';
import { BotonLink, Marca, Patente } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { usuarioActual } from '@/lib/supabase/server';

const ACTORES = [
  {
    quien: 'Flotas',
    que: 'Services por km o fecha, órdenes de trabajo, RTO, seguros y licencias, neumáticos con historia propia y el control diario del chofer.',
  },
  {
    quien: 'Talleres',
    que: 'Reciben las órdenes que les deriva cada flota, informan avance, repuestos y mano de obra, y cierran el trabajo.',
  },
  {
    quien: 'Recapadoras',
    que: 'Reciben los neumáticos enviados a recapar con todo su historial y registran la nueva vida o el rechazo.',
  },
];

export default async function Inicio() {
  const usuario = supabaseConfigurado() ? await usuarioActual() : null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-14 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <Marca chica />
        <nav className="flex items-center gap-2">
          {usuario ? (
            <BotonLink href="/empresas">Ir a mis empresas</BotonLink>
          ) : (
            <>
              <Link href="/ingresar" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2">Ingresar</Link>
              <BotonLink href="/registrarse">Crear cuenta</BotonLink>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-col gap-6 pt-6">
        <span className="eyebrow">Mantenimiento de camiones · Argentina</span>
        <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.02] sm:text-6xl">
          Cada camión y cada neumático con su historia, al día.
        </h1>
        <p className="max-w-2xl text-lg text-ink-2">
          Flotapp ordena el mantenimiento de tu flota y lo conecta con tus talleres y recapadoras. Cada empresa ve sólo lo suyo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <BotonLink href={usuario ? '/empresas' : '/registrarse'}>{usuario ? 'Ir a mis empresas' : 'Empezar'}</BotonLink>
          <span className="flex items-center gap-2 text-sm text-ink-3">
            <Patente dominio="AF 123 KD" /> <Patente dominio="OPQ 318" /> Mercosur y formato anterior
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {ACTORES.map((a) => (
          <div key={a.quien} className="flex flex-col gap-2 border-t-2 border-ink pt-4">
            <h2 className="font-display text-2xl font-bold">{a.quien}</h2>
            <p className="text-ink-2">{a.que}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-line pt-6 text-sm text-ink-3">
        Los plazos normativos (RTO, tacógrafo, licencias) son editables por cada empresa. Verificá siempre la norma vigente.
      </footer>
    </main>
  );
}
