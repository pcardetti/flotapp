'use client';

import { usePathname } from 'next/navigation';
import { PantallaError } from '@/components/error-pantalla';

export default function ErrorChofer({ error, retry }: { error: unknown; retry: () => void }) {
  const enInicio = usePathname() === '/chofer';
  return <PantallaError error={error} retry={retry} salida={enInicio ? undefined : { href: '/chofer', texto: 'Ir al inicio' }} movil />;
}
