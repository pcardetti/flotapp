import { LayoutDashboard, LogOut, Route, Smartphone, Wrench } from 'lucide-react';
import Link from 'next/link';
import { salir } from '@/app/(auth)/acciones';
import { Fila, Seccion } from '@/components/movil';
import { appDeRol, inicioDe } from '@/lib/apps';
import { misEmpresas, NOMBRE_ROL } from '@/lib/empresa';

const ICONO = { flota: LayoutDashboard, chofer: Route, taller: Wrench };
const APP = { flota: 'Tallerflota', chofer: 'App Chofer', taller: 'App Taller' };

// Cuenta compartida por las apps de celular: empresas, accesos a las otras apps y salir.
export async function Cuenta({ email }: { email: string }) {
  const empresas = await misEmpresas();
  return (
    <>
      <Seccion titulo="Tu cuenta">
        <Fila><span className="min-w-0 truncate font-semibold">{email}</span></Fila>
      </Seccion>
      <Seccion titulo="Tus empresas">
        {empresas.map((m) => {
          const app = appDeRol(m);
          const Icono = ICONO[app];
          return (
            <Link key={m.organizacion.id} href={inicioDe(m)} className="tap">
              <Fila>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-ink"><Icono className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.organizacion.nombre}</p>
                  <p className="text-sm text-ink-3">{NOMBRE_ROL[m.rol]} · {APP[app]}</p>
                </div>
              </Fila>
            </Link>
          );
        })}
      </Seccion>
      <Seccion titulo="Instalar en el celular">
        <Fila className="items-start">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-ink-3" />
          <p className="text-sm text-ink-2">En el menú del navegador elegí <b>Agregar a la pantalla de inicio</b> o <b>Instalar app</b>. Queda con su propio ícono, como una app más.</p>
        </Fila>
      </Seccion>
      <Seccion>
        <form action={salir}>
          <button className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-crit">
            <LogOut className="size-5" />Salir
          </button>
        </form>
      </Seccion>
    </>
  );
}
