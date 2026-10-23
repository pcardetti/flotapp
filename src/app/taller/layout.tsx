import { ClipboardCheck, History, Truck, UserRound } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import { BarraInferior } from '@/components/barra-inferior';
import { AppMovil } from '@/components/movil';

export const metadata: Metadata = {
  title: { default: 'Taller', template: '%s · Flotapp Taller' },
  manifest: '/manifests/taller.webmanifest',
  appleWebApp: { capable: true, title: 'Taller', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#0e7490' };

export default function LayoutTaller({ children }: { children: React.ReactNode }) {
  return (
    <AppMovil
      app="taller"
      barra={
        <BarraInferior
          items={[
            { href: '/taller', texto: 'Pendientes', icono: <ClipboardCheck className="size-5" />, exacto: true },
            { href: '/taller/unidades', texto: 'Unidades', icono: <Truck className="size-5" /> },
            { href: '/taller/historial', texto: 'Historial', icono: <History className="size-5" /> },
            { href: '/taller/cuenta', texto: 'Cuenta', icono: <UserRound className="size-5" /> },
          ]}
          ocultarEn={['^/taller/(escanear$|orden/|unidad/[^/]+/(trabajo|orden)$)']}
        />
      }
    >
      {children}
    </AppMovil>
  );
}
