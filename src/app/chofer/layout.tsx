import { Home, Receipt, Route, UserRound } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import { BarraInferior } from '@/components/barra-inferior';
import { AppMovil } from '@/components/movil';

export const metadata: Metadata = {
  title: { default: 'Chofer', template: '%s · Flotapp Chofer' },
  manifest: '/manifests/chofer.webmanifest',
  appleWebApp: { capable: true, title: 'Chofer', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#f2b705' };

export default function LayoutChofer({ children }: { children: React.ReactNode }) {
  return (
    <AppMovil
      app="chofer"
      barra={
        <BarraInferior
          items={[
            { href: '/chofer', texto: 'Inicio', icono: <Home className="size-5" />, exacto: true },
            { href: '/chofer/viajes', texto: 'Viajes', icono: <Route className="size-5" /> },
            { href: '/chofer/gastos', texto: 'Gastos', icono: <Receipt className="size-5" /> },
            { href: '/chofer/cuenta', texto: 'Cuenta', icono: <UserRound className="size-5" /> },
          ]}
          ocultarEn={['^/chofer/(salida/|gasto$|falla$|viaje/|escanear$)']}
        />
      }
    >
      {children}
    </AppMovil>
  );
}
