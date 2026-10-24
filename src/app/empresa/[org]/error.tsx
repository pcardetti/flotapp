'use client';

import { useParams, usePathname } from 'next/navigation';
import { PantallaError } from '@/components/error-pantalla';

export default function ErrorEmpresa({ error, retry }: { error: unknown; retry: () => void }) {
  const { org } = useParams<{ org: string }>();
  // Si lo que falla es el inicio de la empresa, la salida es la lista de empresas.
  const enInicio = usePathname().endsWith('/panel');
  const salida = enInicio ? { href: '/empresas', texto: 'Ir a mis empresas' } : { href: `/empresa/${org}/panel`, texto: 'Ir al inicio' };
  return <PantallaError error={error} retry={retry} salida={salida} />;
}
