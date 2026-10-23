'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Menu({ org, secciones }: { org: string; secciones: { ruta: string; titulo: string }[] }) {
  const actual = usePathname().split('/')[3] ?? 'panel';
  return (
    <nav aria-label="Secciones" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {secciones.map((s) => {
        const activa = s.ruta === actual;
        return (
          <Link
            key={s.ruta}
            href={`/empresa/${org}/${s.ruta}`}
            aria-current={activa ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${activa ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
          >
            {s.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
