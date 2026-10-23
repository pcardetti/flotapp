'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ItemBarra = { href: string; texto: string; icono: React.ReactNode; exacto?: boolean };

// Barra inferior de las apps de celular: íconos grandes, la sección actual resaltada. En los formularios
// (rutas de `ocultarEn`, expresiones regulares) se esconde: más lugar y nada que tocar sin querer.
export function BarraInferior({ items, ocultarEn = [] }: { items: ItemBarra[]; ocultarEn?: string[] }) {
  const ruta = usePathname();
  if (ocultarEn.some((patron) => new RegExp(patron).test(ruta))) return null;
  return (
    <nav
      aria-label="Secciones"
      style={{ viewTransitionName: 'barra-inferior' }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-lg">
        {items.map((it) => {
          const activo = it.exacto ? ruta === it.href : ruta === it.href || ruta.startsWith(it.href + '/');
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={activo ? 'page' : undefined}
                className={`tap flex h-16 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold ${activo ? 'text-ink' : 'text-ink-3'}`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${activo ? 'bg-accent text-accent-ink' : ''}`}>{it.icono}</span>
                {it.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
