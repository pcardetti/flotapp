import { ChevronLeft } from 'lucide-react';
import { Atras } from './pantalla';

// Marco de las apps de celular (Chofer y Taller): pensado para una mano y para usar al sol.

export function AppMovil({ app, children, barra }: { app: 'chofer' | 'taller'; children: React.ReactNode; barra: React.ReactNode }) {
  return (
    <div data-app={app} className="min-h-dvh bg-bg">
      <div className="mx-auto w-full max-w-lg pb-[calc(env(safe-area-inset-bottom)+var(--alto-barra)+32px)]">{children}</div>
      {barra}
    </div>
  );
}

export function EncabezadoMovil({ titulo, bajada, atras, accion }: { titulo: string; bajada?: React.ReactNode; atras?: string; accion?: React.ReactNode }) {
  return (
    <header
      style={{ viewTransitionName: 'encabezado' }}
      className="sticky top-0 z-20 flex items-center gap-2 border-b border-line/70 bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur"
    >
      {atras && (
        <Atras href={atras} aria-label="Volver" className="tap -ml-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
          <ChevronLeft className="size-6" />
        </Atras>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate font-display text-2xl font-bold leading-tight">{titulo}</h1>
        {bajada && <div className="truncate text-sm text-ink-3">{bajada}</div>}
      </div>
      {accion}
    </header>
  );
}

// Botón principal siempre a mano, por encima de la barra inferior. El degradé tapa la lista que pasa por debajo.
export function AccionFija({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--alto-barra))] z-30 bg-linear-to-t from-bg from-60% to-transparent px-4 pb-3 pt-8">
      <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2">{children}</div>
    </div>
  );
}

export function Seccion({ titulo, children, accion }: { titulo?: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 px-4 pt-5">
      {(titulo || accion) && (
        <div className="flex items-baseline justify-between gap-3">
          {titulo && <h2 className="eyebrow">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

// Fila grande y tocable para listas en el celular.
export function Fila({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 ${className}`}>{children}</div>;
}

export function Vacio({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line bg-surface px-6 py-8 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-3">{icono}</div>
      <p className="font-semibold">{titulo}</p>
      {children && <div className="max-w-xs text-sm text-ink-3">{children}</div>}
    </div>
  );
}
