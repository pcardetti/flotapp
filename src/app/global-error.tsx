'use client';

import { PantallaError } from '@/components/error-pantalla';
import './globals.css';

// Último recurso, si falla el diseño raíz: reemplaza toda la página, así que trae su propio <html> y estilos.
export default function ErrorRaiz({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-AR">
      {/* Sin el diseño raíz no están cargadas las tipografías de la marca: se usa la del sistema. */}
      <body className="min-h-dvh bg-bg text-[15px] leading-normal text-ink antialiased" style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
        <title>Flotapp</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
          <PantallaError error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
