'use client';

import { PantallaError } from '@/components/error-pantalla';
import { Marca } from '@/components/ui';

// Errores fuera de las tres apps (elegir empresa, invitaciones, QR…) y de sus diseños.
export default function ErrorGeneral({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 px-4">
      <Marca chica />
      <PantallaError error={error} retry={retry} salida={{ href: '/empresas', texto: 'Ir a mis empresas' }} />
    </main>
  );
}
