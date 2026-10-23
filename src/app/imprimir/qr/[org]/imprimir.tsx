'use client';

import { Printer } from 'lucide-react';

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="tap inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
      <Printer className="size-4" />Imprimir
    </button>
  );
}
