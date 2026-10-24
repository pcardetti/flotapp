'use client';

import { Check, CircleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Avisos flotantes de toda la app ("Gasto eliminado", "No pudimos guardar…"). Cualquier componente del navegador
// llama a avisar(); el contenedor <Avisos /> vive una sola vez en el diseño raíz y los muestra arriba, al centro.

type TipoAviso = 'ok' | 'error';
type Aviso = { id: number; texto: string; tipo: TipoAviso };

const EVENTO = 'flotapp:aviso';
const DURACION: Record<TipoAviso, number> = { ok: 3200, error: 6000 };
let siguiente = 0;

export function avisar(texto: string, tipo: TipoAviso = 'ok') {
  window.dispatchEvent(new CustomEvent<Aviso>(EVENTO, { detail: { id: ++siguiente, texto, tipo } }));
}

export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const quitar = (id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id));

  useEffect(() => {
    const recibir = (e: Event) => {
      const aviso = (e as CustomEvent<Aviso>).detail;
      // Como mucho tres a la vez: el más viejo deja lugar.
      setAvisos((lista) => [...lista.slice(-2), aviso]);
      navigator.vibrate?.(aviso.tipo === 'error' ? [30, 60, 30] : 20);
      setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== aviso.id)), DURACION[aviso.tipo]);
    };
    window.addEventListener(EVENTO, recibir);
    return () => window.removeEventListener(EVENTO, recibir);
  }, []);

  // Dos regiones que siempre están en la página: el lector de pantalla anuncia lo que aparece en ellas sin mover
  // el foco (los errores, con prioridad).
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[60] flex flex-col items-center gap-2 px-4">
      {(['ok', 'error'] as const).map((tipo) => (
        <div key={tipo} role={tipo === 'ok' ? 'status' : 'alert'} className="flex flex-col items-center gap-2">
          {avisos.filter((a) => a.tipo === tipo).map((a) => <Burbuja key={a.id} aviso={a} cerrar={() => quitar(a.id)} />)}
        </div>
      ))}
    </div>
  );
}

function Burbuja({ aviso, cerrar }: { aviso: Aviso; cerrar: () => void }) {
  const Icono = aviso.tipo === 'ok' ? Check : CircleAlert;
  return (
    <div className={`aparecer pointer-events-auto flex max-w-md items-center gap-2 rounded-full py-2.5 pl-4 pr-2 text-sm font-semibold shadow-tarjeta ${aviso.tipo === 'ok' ? 'bg-ink text-bg' : 'bg-crit text-bg'}`}>
      <Icono className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0">{aviso.texto}</span>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="tap -my-1 grid size-8 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
