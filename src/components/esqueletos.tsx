// Pantallas de espera (loading.tsx): aparecen apenas se toca un enlace, con la forma de lo que viene, mientras
// llega la información. El lector de pantalla oye "Cargando…"; los bloques grises no se leen.

function Bloque({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`esqueleto ${className}`} />;
}

function Cargando({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

// App de gestión: título, una fila de números y dos tarjetas con filas.
export function EsqueletoGestion() {
  return (
    <Cargando className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Bloque className="h-9 w-56 max-w-full sm:h-10" />
        <Bloque className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Bloque key={i} className="h-24 rounded-xl" />)}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          <Bloque className="h-6 w-40" />
          {[1, 2, 3].map((j) => <Bloque key={j} className="h-12 rounded-lg" />)}
        </div>
      ))}
    </Cargando>
  );
}

// Apps del celular: el encabezado fijo y filas grandes, como las listas de Chofer y Taller. El encabezado comparte
// nombre de transición con el de cada pantalla, así queda quieto mientras cambia lo de abajo.
export function EsqueletoMovil() {
  return (
    <Cargando>
      <div
        style={{ viewTransitionName: 'encabezado' }}
        className="sticky top-0 z-20 flex flex-col gap-2 border-b border-line/70 bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur"
      >
        <Bloque className="h-7 w-44" />
        <Bloque className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-5">
        <Bloque className="h-3 w-24 rounded" />
        {[1, 2, 3, 4].map((i) => <Bloque key={i} className="h-16 rounded-2xl" />)}
      </div>
    </Cargando>
  );
}
