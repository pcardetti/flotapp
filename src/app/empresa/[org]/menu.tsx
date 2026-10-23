'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function Menu({ org, secciones }: { org: string; secciones: { ruta: string; titulo: string; icono: React.ReactNode }[] }) {
  const actual = usePathname().split('/')[3] ?? 'panel';
  const activaRef = useRef<HTMLAnchorElement>(null);
  // En el celular el menú se desliza de costado: la sección abierta queda siempre a la vista.
  useEffect(() => {
    activaRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [actual]);
  return (
    <nav aria-label="Secciones" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {secciones.map((s) => {
        const activa = s.ruta === actual;
        return (
          <Link
            key={s.ruta}
            ref={activa ? activaRef : undefined}
            href={`/empresa/${org}/${s.ruta}`}
            aria-current={activa ? 'page' : undefined}
            className={`tap flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${activa ? 'bg-accent text-accent-ink shadow-tarjeta' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
          >
            <span className="[&>svg]:size-[18px]">{s.icono}</span>
            {s.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
