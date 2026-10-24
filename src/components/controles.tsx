'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { avisar } from './avisos';

// Controles grandes para usar con una mano en el celular.

export const NIVELES = [
  { valor: 10, texto: 'Reserva', nombre: 'En reserva' },
  { valor: 25, texto: '¼', nombre: 'Un cuarto' },
  { valor: 50, texto: '½', nombre: 'Medio tanque' },
  { valor: 75, texto: '¾', nombre: 'Tres cuartos' },
  { valor: 100, texto: 'Lleno', nombre: 'Lleno' },
] as const;

export function NivelCombustible({ nombre, valor, alCambiar }: { nombre?: string; valor?: number | null; alCambiar?: (v: number) => void }) {
  const [elegido, setElegido] = useState<number | null>(valor ?? null);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-2">Combustible</legend>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
        {NIVELES.map((n) => {
          const activo = elegido === n.valor;
          return (
            <label key={n.valor} className={`tap relative flex h-16 cursor-pointer flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl border pb-2 text-sm font-bold ${activo ? 'border-accent ring-2 ring-accent' : 'border-line bg-surface'}`}>
              <input type="radio" name={nombre} value={n.valor} aria-label={n.nombre} checked={activo} onChange={() => { setElegido(n.valor); alCambiar?.(n.valor); }} className="sr-only" required={Boolean(nombre)} />
              <span aria-hidden className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${activo ? 'bg-accent/35' : 'bg-surface-2'}`} style={{ height: `${n.valor}%` }} />
              <span className="relative">{n.texto}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Separador de miles mientras se escribe: "198650" → "198.650". Con decimales admite una coma: "125000,5" → "125.000,5".
export function conMiles(texto: string, decimales = false) {
  const [entero, ...resto] = texto.replace(decimales ? /[^\d,]/g : /\D/g, '').split(',');
  const miles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimales && resto.length ? `${miles},${resto.join('').slice(0, 2)}` : miles;
}

// Kilometraje grande, con el último registrado como referencia.
export function CampoKm({ nombre = 'km', ultimo, etiqueta = 'Kilometraje del tablero', valor, alCambiar, error }: {
  nombre?: string;
  ultimo?: number | null;
  etiqueta?: string;
  valor?: string;
  alCambiar?: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="text-sm font-semibold text-ink-2">{etiqueta}</label>
      <div className="relative">
        <input
          id={nombre}
          name={nombre}
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          onChange={alCambiar ? (e) => alCambiar(conMiles(e.target.value)) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${nombre}-error` : undefined}
          className={`h-16 w-full rounded-2xl border bg-surface px-4 pr-14 font-display text-3xl font-bold tracking-wide outline-none focus:border-transparent focus:ring-2 focus:ring-accent ${error ? 'border-crit' : 'border-line'}`}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-ink-3">km</span>
      </div>
      {error ? (
        <span id={`${nombre}-error`} className="text-sm font-semibold text-crit">{error}</span>
      ) : (
        ultimo != null && <span className="text-xs text-ink-3">Último registrado: {ultimo.toLocaleString('es-AR')} km</span>
      )}
    </div>
  );
}

// Botón de envío con estado: se deshabilita y muestra que está trabajando.
export function BotonEnviar({ children, pendiente, deshabilitado, variante = 'primario', className = '' }: {
  children: React.ReactNode;
  pendiente?: string;
  deshabilitado?: boolean;
  variante?: 'primario' | 'peligro' | 'secundario';
  className?: string;
}) {
  const { pending } = useFormStatus();
  const estilos = {
    primario: 'bg-accent text-accent-ink',
    peligro: 'bg-crit text-bg',
    secundario: 'border border-line bg-surface text-ink',
  }[variante];
  return (
    <button
      type="submit"
      disabled={pending || deshabilitado}
      className={`tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold shadow-tarjeta disabled:opacity-55 ${estilos} ${className}`}
    >
      {pending ? <><Loader2 className="size-5 animate-spin" />{pendiente ?? 'Guardando…'}</> : children}
    </button>
  );
}

// Después de un envío con errores, lleva la vista y el foco al primer campo marcado (aria-invalid): en el celular
// puede haber quedado fuera de la pantalla o tapado por el botón fijo. El lector de pantalla lee el campo y su error.
export function useEnfocarError(errores?: Record<string, string | undefined>) {
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!errores || !Object.values(errores).some(Boolean)) return;
    const campo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!campo) return;
    campo.focus({ preventScroll: true });
    campo.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [errores]);
  return formulario;
}

// Aviso de lo que se acaba de guardar en otra pantalla (por ejemplo, "Viaje iniciado"), que llega en ?ok=.
export function Toast({ mensaje }: { mensaje?: string | null }) {
  useEffect(() => {
    if (!mensaje) return;
    avisar(mensaje);
    // Se llega acá después de guardar algo: la pantalla arranca desde arriba, no donde quedó el formulario.
    window.scrollTo({ top: 0 });
    // Se limpia el parámetro de la dirección para que no reaparezca al recargar.
    const url = new URL(window.location.href);
    if (url.searchParams.has('ok')) {
      url.searchParams.delete('ok');
      window.history.replaceState(window.history.state, '', url);
    }
  }, [mensaje]);
  return null;
}
