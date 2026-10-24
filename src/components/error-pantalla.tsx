'use client';

import { RotateCw, TriangleAlert, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Cuando una pantalla no puede cargar (la base no responde, se cortó la señal…): qué pasó en palabras simples,
// "Probar de nuevo" y, si sirve, una salida. El código permite encontrar el error en los registros del servidor;
// el detalle técnico nunca llega al navegador.
export function PantallaError({ error, retry, salida, movil = false }: {
  error: unknown;
  retry: () => void;
  salida?: { href: string; texto: string };
  movil?: boolean;
}) {
  const [sinConexion, setSinConexion] = useState(false);
  useEffect(() => {
    console.error(error);
    const revisar = () => setSinConexion(!navigator.onLine);
    revisar();
    window.addEventListener('online', revisar);
    window.addEventListener('offline', revisar);
    return () => {
      window.removeEventListener('online', revisar);
      window.removeEventListener('offline', revisar);
    };
  }, [error]);

  const codigo = error instanceof Error && 'digest' in error ? String(error.digest ?? '') : '';
  const Icono = sinConexion ? WifiOff : TriangleAlert;
  const boton = movil ? 'h-14 w-full rounded-2xl text-lg font-bold' : 'h-10 rounded-lg px-4 text-sm font-semibold';
  return (
    <div role="alert" className={`flex flex-col items-start gap-4 ${movil ? 'px-4 pb-10 pt-[calc(env(safe-area-inset-top)+28px)]' : 'py-6'}`}>
      <div className="grid size-12 place-items-center rounded-full bg-crit-soft text-crit"><Icono className="size-6" aria-hidden /></div>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-bold leading-tight">{sinConexion ? 'Sin conexión' : 'No pudimos cargar esta pantalla'}</h1>
        <p className="max-w-prose text-ink-2">
          {sinConexion
            ? 'Revisá la señal o el wifi y probá de nuevo. Lo que ya guardaste no se pierde.'
            : 'Puede ser un problema momentáneo. Probá de nuevo; si sigue pasando, avisá a quien administra la empresa.'}
        </p>
      </div>
      <div className={`flex gap-2 ${movil ? 'w-full flex-col' : 'flex-wrap'}`}>
        <button type="button" onClick={() => retry()} className={`tap inline-flex items-center justify-center gap-2 bg-accent text-accent-ink hover:brightness-110 ${boton}`}>
          <RotateCw className="size-4" aria-hidden />Probar de nuevo
        </button>
        {salida && (
          <Link href={salida.href} className={`tap inline-flex items-center justify-center border border-line bg-surface text-ink hover:border-ink-3 ${boton}`}>
            {salida.texto}
          </Link>
        )}
      </div>
      {codigo && !sinConexion && <p className="text-xs text-ink-3">Código del error: {codigo}</p>}
    </div>
  );
}
