export function Encabezado({ titulo, bajada, children }: { titulo: string; bajada?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {bajada && <span className="eyebrow">{bajada}</span>}
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-surface p-6">
      <h2 className="font-display text-2xl font-bold">{titulo}</h2>
      <div className="max-w-prose text-ink-2">{children}</div>
    </div>
  );
}
