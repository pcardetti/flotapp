'use client';

import { usePathname } from 'next/navigation';
import { PantallaError } from '@/components/error-pantalla';

export default function ErrorTaller({ error, retry }: { error: unknown; retry: () => void }) {
  const enInicio = usePathname() === '/taller';
  return <PantallaError error={error} retry={retry} salida={enInicio ? undefined : { href: '/taller', texto: 'Ir a pendientes' }} movil />;
}
