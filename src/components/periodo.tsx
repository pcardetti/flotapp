import Link from 'next/link';
import { PERIODOS } from '@/lib/periodos';

// Pestañas de período. `consulta` conserva los demás parámetros de la dirección (por ejemplo, el filtro del historial);
// `compacto` usa siempre los nombres cortos, para columnas angostas.
export function SelectorPeriodo({ actual, consulta = {}, compacto = false }: { actual: string; consulta?: Record<string, string | undefined>; compacto?: boolean }) {
  const href = (p: string) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(consulta).filter((e): e is [string, string] => Boolean(e[1]))), p })}`;
  return (
    <div className={`grid w-full grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1 ${compacto ? '' : 'sm:flex sm:w-auto'}`} role="tablist" aria-label="Período">
      {PERIODOS.map((x) => (
        <Link key={x.clave} href={href(x.clave)} scroll={false} role="tab" aria-selected={actual === x.clave}
          className={`tap rounded-xl px-3 py-1.5 text-center text-sm font-semibold ${actual === x.clave ? 'bg-surface text-ink shadow-tarjeta' : 'text-ink-3 hover:text-ink'}`}>
          {compacto ? x.corto : <><span className="sm:hidden">{x.corto}</span><span className="hidden sm:inline">{x.texto}</span></>}
        </Link>
      ))}
    </div>
  );
}
