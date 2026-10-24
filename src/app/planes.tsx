'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useEnfocarError } from '@/components/controles';
import { Aviso, Boton, BotonLink, Campo } from '@/components/ui';
import { pesos } from '@/lib/formato';
import { desde, INCLUYE, MAX_UNIDADES, PLANES, planPara, type Plan } from '@/lib/planes';
import { solicitarContratacion, type EstadoPedido } from './acciones';

const unidadesDe = (texto: string) => Math.min(MAX_UNIDADES, Math.max(1, Number.parseInt(texto, 10) || 1));
const alcance = (p: Plan) => (p.hasta === null ? `Más de ${desde(p) - 1} unidades` : p.hasta <= 5 ? `Hasta ${p.hasta} unidades` : `De ${desde(p)} a ${p.hasta} unidades`);

// Planes, calculador y pedido de contratación de la página de inicio. Los tres comparten la cantidad de
// unidades: al moverla se marca el plan que corresponde y el pedido sale con ese número.
export function PlanesYContratacion() {
  const [cantidad, setCantidad] = useState('8');
  const unidades = unidadesDe(cantidad);
  const plan = planPara(unidades);
  const poner = (n: number) => setCantidad(String(Math.min(MAX_UNIDADES, Math.max(1, n))));

  // Lleva al pedido (con el plan ya elegido) y deja el cursor en el primer campo.
  const irAContratar = () => {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('contratar')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    document.getElementById('empresa')?.focus({ preventScroll: true });
  };
  // Elegir una tarjeta acomoda la cantidad al plan sólo si no entra en él.
  const elegir = (p: Plan) => {
    poner(Math.min(Math.max(unidades, desde(p)), p.hasta ?? Math.max(unidades, desde(p))));
    irAContratar();
  };

  return (
    <>
      <section id="planes" aria-labelledby="titulo-planes" className="flex scroll-mt-6 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-planes" className="font-display text-3xl font-bold sm:text-4xl">Planes y precios</h2>
          <p className="max-w-2xl text-ink-2">Un precio fijo por mes según cuántas unidades tenga tu flota. Todos los planes incluyen todo.</p>
        </div>

        <div className="grid gap-6 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2 md:items-center md:p-6">
          <div className="flex flex-col gap-3">
            <label htmlFor="calculador" className="text-lg font-semibold">¿Cuántas unidades tiene tu flota?</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => poner(unidades - 1)} aria-label="Una unidad menos" className="tap grid size-12 place-items-center rounded-xl border border-line hover:border-ink-3">
                <Minus className="size-5" aria-hidden />
              </button>
              <input
                id="calculador"
                inputMode="numeric"
                autoComplete="off"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={() => poner(unidades)}
                className="h-12 w-24 rounded-xl border border-line bg-surface text-center font-display text-3xl font-bold outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
              />
              <button type="button" onClick={() => poner(unidades + 1)} aria-label="Una unidad más" className="tap grid size-12 place-items-center rounded-xl border border-line hover:border-ink-3">
                <Plus className="size-5" aria-hidden />
              </button>
              <span className="text-ink-3">unidades</span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={Math.min(unidades, 60)}
              onChange={(e) => poner(Number(e.target.value))}
              aria-label="Cantidad de unidades"
              className="w-full accent-[var(--accent)]"
            />
            <p className="text-xs text-ink-3">Cuenta cada vehículo con patente: camiones, tractores, semirremolques y acoplados.</p>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-xl bg-accent-soft p-5">
            <span className="eyebrow">Tu plan</span>
            <p aria-live="polite" className="font-display text-3xl font-bold">{plan.nombre}</p>
            {plan.precio === null ? (
              <p className="text-ink-2">Para más de {desde(plan) - 1} unidades armamos un precio para tu operación.</p>
            ) : (
              <p className="text-ink-2">
                <span className="font-display text-4xl font-bold text-ink">{pesos(plan.precio)}</span> por mes + IVA
              </p>
            )}
            <Boton type="button" onClick={irAContratar} className="mt-2">{plan.precio === null ? 'Pedir una cotización' : `Contratar el plan ${plan.nombre}`}</Boton>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANES.map((p) => {
            const elegido = p === plan;
            return (
              <li key={p.clave} className={`flex flex-col gap-3 rounded-2xl border bg-surface p-5 ${elegido ? 'border-accent ring-2 ring-accent' : 'border-line'}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl font-bold">{p.nombre}</h3>
                  {elegido && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Tu plan</span>}
                </div>
                <p className="text-sm font-semibold text-ink-3">{alcance(p)}</p>
                <p>
                  {p.precio === null ? (
                    <span className="font-display text-3xl font-bold">A cotizar</span>
                  ) : (
                    <><span className="font-display text-3xl font-bold">{pesos(p.precio)}</span> <span className="text-sm text-ink-3">por mes + IVA</span></>
                  )}
                </p>
                <p className="flex-1 text-ink-2">{p.bajada}</p>
                <Boton type="button" variante={elegido ? 'primario' : 'secundario'} onClick={() => elegir(p)}>
                  {p.precio === null ? 'Pedir cotización' : 'Contratar'}
                </Boton>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-semibold">Todos los planes incluyen</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUYE.map((i) => (
              <li key={i} className="flex items-start gap-2 text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{i}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-ink-3">Precios en pesos argentinos, por mes y sin IVA. Sin permanencia mínima.</p>
      </section>

      <section id="contratar" aria-labelledby="titulo-contratar" className="flex scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-contratar" className="font-display text-3xl font-bold sm:text-4xl">Contratar Flotapp</h2>
          <p className="max-w-2xl text-ink-2">Dejanos tus datos y te contactamos para dar de alta tu empresa y coordinar el pago.</p>
        </div>
        <FormContratar cantidad={cantidad} setCantidad={setCantidad} plan={plan} />
      </section>
    </>
  );
}

function FormContratar({ cantidad, setCantidad, plan }: { cantidad: string; setCantidad: (v: string) => void; plan: Plan }) {
  const [estado, enviar] = useActionState<EstadoPedido, FormData>(solicitarContratacion, {});
  const formulario = useEnfocarError(estado.errores);
  if (estado.ok) {
    const { nombre, empresa, plan: nombrePlan, unidades } = estado.ok;
    return (
      <div role="status" className="aparecer flex flex-col items-start gap-3 rounded-2xl border border-ok bg-ok-soft p-6">
        <h3 className="font-display text-2xl font-bold">¡Gracias, {nombre}!</h3>
        <p>Recibimos el pedido de <b>{empresa}</b>: plan {nombrePlan}, {unidades} {unidades === 1 ? 'unidad' : 'unidades'}. Te vamos a escribir para coordinar el alta y el pago.</p>
        <p className="text-ink-2">Mientras tanto ya podés crear tu cuenta y empezar a cargar tus unidades.</p>
        <BotonLink href="/registrarse">Crear mi cuenta</BotonLink>
      </div>
    );
  }
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    <form ref={formulario} action={enviar} noValidate className="relative grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 md:p-6">
      <Campo label="Empresa" name="empresa" autoComplete="organization" required defaultValue={v.empresa} error={e.empresa} />
      <Campo label="Tu nombre" name="nombre" autoComplete="name" required defaultValue={v.nombre} error={e.nombre} />
      <Campo label="Mail" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <Campo label="WhatsApp" name="telefono" type="tel" autoComplete="tel" placeholder="11 5555 0102" required defaultValue={v.telefono} error={e.telefono} />
      <Campo
        label="Unidades"
        name="unidades"
        inputMode="numeric"
        autoComplete="off"
        required
        value={cantidad}
        onChange={(x) => setCantidad(x.target.value.replace(/\D/g, '').slice(0, 4))}
        error={e.unidades}
        ayuda={`Plan ${plan.nombre}${plan.precio === null ? ': precio a cotizar' : `: ${pesos(plan.precio)} por mes + IVA`}`}
      />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="comentario" className="text-sm font-semibold text-ink-2">¿Algo que quieras contarnos? <span className="font-normal text-ink-3">(opcional)</span></label>
        <textarea id="comentario" name="comentario" rows={3} defaultValue={v.comentario} maxLength={1000} placeholder="Tipo de flota, si tenés taller propio, desde cuándo lo necesitás…"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent" />
      </div>
      {/* Trampa para robots: las personas no la ven ni llegan con el teclado. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>No completar <input name="sitio_web" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {estado.error && <div className="sm:col-span-2"><Aviso tipo="error">{estado.error}</Aviso></div>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Enviar />
        <p className="text-sm text-ink-3">No te cobramos nada sin tu confirmación.</p>
      </div>
    </form>
  );
}

function Enviar() {
  const { pending } = useFormStatus();
  return <Boton type="submit" disabled={pending} className="h-11">{pending ? 'Enviando…' : 'Enviar pedido'}</Boton>;
}
