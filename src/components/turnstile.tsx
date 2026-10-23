'use client';

import { useEffect, useRef, useState } from 'react';

type ApiTurnstile = {
  render: (caja: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: ApiTurnstile }
}

const SITIO = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const turnstileActivo = Boolean(SITIO);

let carga: Promise<void> | null = null;
function cargarScript(nonce?: string) {
  carga ??= new Promise<void>((listo, fallo) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    // Con el nonce, Turnstile pasa la autorización de la CSP a lo que carga después.
    if (nonce) script.nonce = nonce;
    script.onload = () => listo();
    script.onerror = () => {
      carga = null;
      fallo(new Error('No cargó Turnstile'));
    };
    document.head.appendChild(script);
  });
  return carga;
}

// Verificación anti-robots de Cloudflare. Casi siempre es invisible: sólo pide un toque si sospecha.
// Deja el token en un campo oculto del formulario ("cf-turnstile-response") y avisa cuándo está listo.
// `reinicio` cambia después de cada envío: el token sirve una sola vez, así que se pide otro.
export function Turnstile({ nonce, alCambiar, reinicio }: { nonce?: string; alCambiar: (listo: boolean) => void; reinicio: unknown }) {
  const caja = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!SITIO) return;
    let activo = true;
    cargarScript(nonce)
      .then(() => {
        if (!activo || !caja.current || !window.turnstile) return;
        widget.current = window.turnstile.render(caja.current, {
          sitekey: SITIO,
          language: 'es',
          theme: 'auto',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: () => { setError(false); alCambiar(true); },
          'expired-callback': () => alCambiar(false),
          'error-callback': () => { setError(true); alCambiar(false); },
        });
      })
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [nonce, alCambiar]);

  useEffect(() => {
    if (!widget.current) return;
    alCambiar(false);
    window.turnstile?.reset(widget.current);
  }, [reinicio, alCambiar]);

  if (!SITIO) return null;
  return (
    <div className="flex flex-col gap-2">
      <div ref={caja} />
      {error && (
        <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          No pudimos cargar la verificación anti-robots. Revisá la conexión o desactivá el bloqueador de anuncios y recargá la página.
        </p>
      )}
    </div>
  );
}
