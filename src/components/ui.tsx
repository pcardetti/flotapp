import Link from 'next/link';

export function Marca({ chica = false }: { chica?: boolean }) {
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={`font-display font-bold leading-none tracking-wide ${chica ? 'text-2xl' : 'text-4xl'}`}>Flotapp</span>
      <span aria-hidden className="block h-0 w-full border-b-2 border-dashed border-road" />
    </span>
  );
}

// Patente argentina: Mercosur (blanca con franja azul) o formato anterior (negra).
export function Patente({ dominio }: { dominio: string }) {
  const d = dominio.toUpperCase().trim();
  const vieja = /^[A-Z]{3}\s?\d{3}$/.test(d);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-2 pt-0.5 font-display text-[0.95rem] font-semibold leading-tight tracking-[0.09em] ${
        vieja ? 'border-[1.5px] border-[#6d6d6d] bg-[#141414] text-[#f1f1f1]' : 'border-[1.5px] border-t-[5px] border-[#1b1b1b] border-t-[#1f4fa8] bg-white text-[#111]'
      }`}
    >
      {d}
    </span>
  );
}

export function Boton({ children, variante = 'primario', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'fantasma' }) {
  const estilos = {
    primario: 'bg-accent text-accent-ink border-accent hover:brightness-110',
    secundario: 'bg-surface text-ink border-line hover:border-ink-3',
    fantasma: 'bg-transparent text-ink-2 border-transparent hover:bg-surface-2',
  }[variante];
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-60 ${estilos} ${className}`}>
      {children}
    </button>
  );
}

export function BotonLink({ href, children, variante = 'primario' }: { href: string; children: React.ReactNode; variante?: 'primario' | 'secundario' }) {
  const estilos = variante === 'primario' ? 'bg-accent text-accent-ink border-accent hover:brightness-110' : 'bg-surface text-ink border-line hover:border-ink-3';
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition ${estilos}`}>
      {children}
    </Link>
  );
}

export function Campo({ label, name, ayuda, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; ayuda?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-ink-2">{label}</label>
      <input id={name} name={name} {...props} className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent" />
      {ayuda && <span className="text-xs text-ink-3">{ayuda}</span>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  const estilos = { info: 'bg-accent-soft text-ink', error: 'bg-crit-soft text-crit', ok: 'bg-ok-soft text-ok' }[tipo];
  return <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3.5 py-2.5 text-sm ${estilos}`}>{children}</div>;
}

export function Tarjeta({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function Pildora({ tipo = 'neutro', children }: { tipo?: 'neutro' | 'ok' | 'warn' | 'crit' | 'info'; children: React.ReactNode }) {
  const estilos = { neutro: 'bg-surface-2 text-ink-2', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', crit: 'bg-crit-soft text-crit', info: 'bg-accent-soft text-accent' }[tipo];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos}`}>{children}</span>;
}

export function ConfigPendiente() {
  return (
    <Aviso tipo="error">
      Falta conectar la base de datos. Cargá <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en
      <code> .env.local</code> (en tu PC) o en Vercel → Settings → Environment Variables.
    </Aviso>
  );
}
