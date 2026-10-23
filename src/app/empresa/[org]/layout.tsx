import {
  Building2, CalendarClock, CircleDot, ClipboardList, Handshake, LayoutDashboard, Receipt, Route, Settings, Truck, Users, Wrench,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/ui';
import { appDeRol, inicioDe } from '@/lib/apps';
import { NOMBRE_ROL, NOMBRE_TIPO, empresaActual, misEmpresas } from '@/lib/empresa';
import { seccionesPara } from '@/lib/navegacion';
import { salir } from '../../(auth)/acciones';
import { Menu } from './menu';

export const metadata: Metadata = {
  manifest: '/manifests/flota.webmanifest',
  appleWebApp: { capable: true, title: 'Flotapp', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

const ICONOS: Record<string, React.ReactNode> = {
  panel: <LayoutDashboard />, flota: <Truck />, viajes: <Route />, taller: <Wrench />, gastos: <Receipt />, vencimientos: <CalendarClock />,
  trabajos: <ClipboardList />, recapados: <CircleDot />, proveedores: <Handshake />, clientes: <Building2 />, equipo: <Users />, ajustes: <Settings />,
};

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const membresia = await empresaActual(org);
  const { organizacion, rol, usuario } = membresia;
  // Choferes y mecánicos trabajan en sus apps; la de gestión es para administración.
  if (appDeRol(membresia) !== 'flota') redirect(inicioDe(membresia));
  const varias = (await misEmpresas()).length > 1;
  const secciones = seccionesPara(organizacion.tipo, rol).map(({ ruta, titulo }) => ({ ruta, titulo, icono: ICONOS[ruta] }));
  const otrasApps = organizacion.tipo === 'flota' && (rol === 'admin' || rol === 'jefe_taller');

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 pb-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-6">
      <aside className="sticky top-0 z-10 -mx-4 flex min-w-0 flex-col gap-3 border-b border-line bg-bg/95 px-4 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur lg:top-5 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:pt-5" style={{ viewTransitionName: 'encabezado' }}>
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
          <Link href={`/empresa/${org}/panel`} aria-label="Ir al tablero"><Marca chica /></Link>
          <div className="min-w-0 text-right lg:text-left">
            <p className="truncate font-semibold">{organizacion.nombre}</p>
            <p className="text-xs text-ink-3">{NOMBRE_TIPO[organizacion.tipo]} · {NOMBRE_ROL[rol]}</p>
          </div>
        </div>
        <Menu org={org} secciones={secciones} />
        <div className="hidden flex-col gap-2 border-t border-line pt-3 text-sm lg:flex">
          {otrasApps && (
            <div className="flex flex-col gap-1 pb-2">
              <span className="eyebrow">Otras apps</span>
              <Link href="/chofer" className="flex items-center gap-2 font-semibold text-ink-2 hover:text-ink"><Route className="size-4" />App Chofer</Link>
              <Link href="/taller" className="flex items-center gap-2 font-semibold text-ink-2 hover:text-ink"><Wrench className="size-4" />App Taller</Link>
            </div>
          )}
          <span className="truncate text-ink-3">{usuario.email}</span>
          {varias && <Link href="/empresas" className="font-semibold text-accent hover:underline">Cambiar de empresa</Link>}
          <form action={salir}><button className="font-semibold text-ink-2 hover:underline">Salir</button></form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 lg:pt-5">{children}</main>
      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-4 text-sm lg:hidden">
        <span className="text-ink-3">{usuario.email}</span>
        {otrasApps && <Link href="/chofer" className="font-semibold text-accent">App Chofer</Link>}
        {otrasApps && <Link href="/taller" className="font-semibold text-accent">App Taller</Link>}
        {varias && <Link href="/empresas" className="font-semibold text-accent">Cambiar de empresa</Link>}
        <form action={salir}><button className="font-semibold text-ink-2">Salir</button></form>
      </footer>
    </div>
  );
}
