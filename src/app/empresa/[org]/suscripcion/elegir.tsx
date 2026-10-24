'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Aviso, Boton } from '@/components/ui';
import { pesos } from '@/lib/formato';
import { desde, precioDe, seCotiza, type Periodo, type Plan } from '@/lib/planes';
import type { EstadoPlan } from './acciones';

// Planes para elegir, con el período mensual o anual. El plan que ya se paga queda marcado y los que no
// alcanzan para las unidades en servicio no se pueden elegir.
export function ElegirPlan({ accion, planes, actual, unidades, cobroEnLinea }: {
  accion: (estado: EstadoPlan, form: FormData) => Promise<EstadoPlan>;
  planes: Plan[];
  actual: { plan: string; periodo: Periodo; paga: boolean };
  unidades: number;
  cobroEnLinea: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(actual.periodo);
  const [estado, enviar] = useActionState(accion, {});
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Cómo pagar" className="inline-flex self-start rounded-xl bg-surface-2 p-1">
        {(['mensual', 'anual'] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={periodo === p} onClick={() => setPeriodo(p)}
            className={`tap rounded-lg px-4 py-2 text-sm font-semibold ${periodo === p ? 'bg-surface text-ink shadow-tarjeta' : 'text-ink-3'}`}>
            {p === 'mensual' ? 'Por mes' : 'Por año · 2 meses de regalo'}
          </button>
        ))}
      </div>
      {!cobroEnLinea && <Aviso>El pago en línea se habilita en breve. Mientras tanto, si querés activar un plan, escribinos desde la página de inicio.</Aviso>}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {planes.map((p) => {
          const precio = precioDe(p, periodo);
          const esElActual = actual.paga && actual.plan === p.clave && (seCotiza(p) || actual.periodo === periodo);
          const noEntra = p.max_unidades !== null && unidades > p.max_unidades;
          return (
            <li key={p.clave} className={`flex flex-col gap-2 rounded-2xl border bg-surface p-5 ${esElActual ? 'border-accent ring-2 ring-accent' : 'border-line'}`}>
              <h3 className="font-display text-2xl font-bold">{p.nombre}</h3>
              <p className="text-sm font-semibold text-ink-3">{p.max_unidades === null ? `Más de ${desde(planes, p) - 1} unidades` : `Hasta ${p.max_unidades} unidades`}</p>
              <p>
                {precio === null ? (
                  <span className="font-display text-3xl font-bold">A cotizar</span>
                ) : (
                  <><span className="font-display text-3xl font-bold tabular-nums">{pesos(precio)}</span> <span className="text-sm text-ink-3">por {periodo === 'anual' ? 'año' : 'mes'} + IVA</span></>
                )}
              </p>
              {periodo === 'anual' && precio !== null && <p className="text-xs text-ink-3">Equivale a {pesos(precio / 12)} por mes</p>}
              <div className="mt-auto pt-2">
                {esElActual ? (
                  <span className="inline-flex rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-ink">Tu plan</span>
                ) : seCotiza(p) ? (
                  <a href="/#contratar" className="font-semibold text-accent-text hover:underline">Pedir una cotización</a>
                ) : noEntra ? (
                  <p className="text-sm text-ink-3">Tenés {unidades} unidades en servicio: no entran en este plan.</p>
                ) : (
                  <form action={enviar}>
                    <input type="hidden" name="plan" value={p.clave} />
                    <input type="hidden" name="periodo" value={periodo} />
                    <Elegir nombre={p.nombre} desactivado={!cobroEnLinea} />
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Elegir({ nombre, desactivado }: { nombre: string; desactivado: boolean }) {
  const { pending } = useFormStatus();
  return <Boton type="submit" disabled={pending || desactivado} className="w-full">{pending ? 'Un momento…' : `Elegir ${nombre}`}</Boton>;
}
