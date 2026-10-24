'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useEnfocarError } from '@/components/controles';
import { Aviso, Boton, BotonLink, Campo } from '@/components/ui';
import { pesos } from '@/lib/formato';
import { DIAS_DE_PRUEBA, desde, INCLUYE, MAX_UNIDADES, planPara, precioDe, seCotiza, type Periodo, type Plan } from '@/lib/planes';
import { solicitarContratacion, type EstadoPedido } from './acciones';

const unidadesDe = (texto: string) => Math.min(MAX_UNIDADES, Math.max(1, Number.parseInt(texto, 10) || 1));

// Planes, calculador y pedido de contacto de la página de inicio. Los tres comparten la cantidad de unidades: al
// moverla se marca el plan que corresponde. Los planes con precio se prueban gratis; el "a medida" se cotiza.
export function PlanesYContratacion({ planes, empezar }: { planes: Plan[]; empezar: string }) {
  const [cantidad, setCantidad] = useState('8');
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  if (!planes.length) return null;
  const unidades = unidadesDe(cantidad);
  const plan = planPara(planes, unidades);
  const poner = (n: number) => setCantidad(String(Math.min(MAX_UNIDADES, Math.max(1, n))));
  const alcance = (p: Plan) => (p.max_unidades === null ? `Más de ${desde(planes, p) - 1} unidades` : desde(planes, p) === 1 ? `Hasta ${p.max_unidades} unidades` : `De ${desde(planes, p)} a ${p.max_unidades} unidades`);

  // Lleva al pedido de contacto y deja el cursor en el primer campo.
  const irAContacto = () => {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('contratar')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    document.getElementById('empresa')?.focus({ preventScroll: true });
  };
  const precio = (p: Plan) => {
    const monto = precioDe(p, periodo);
    if (monto === null) return <span className="font-display text-3xl font-bold">A cotizar</span>;
    return <><span className="font-display text-3xl font-bold tabular-nums">{pesos(monto)}</span> <span className="text-sm text-ink-3">por {periodo === 'anual' ? 'año' : 'mes'} + IVA</span></>;
  };

  return (
    <>
      <section id="planes" aria-labelledby="titulo-planes" className="flex scroll-mt-6 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-planes" className="font-display text-3xl font-bold sm:text-4xl">Planes y precios</h2>
          <p className="max-w-2xl text-ink-2">
            Un precio fijo según cuántas unidades tenga tu flota, con todo incluido. Probalo {DIAS_DE_PRUEBA} días gratis, sin tarjeta.
          </p>
        </div>

        <div role="radiogroup" aria-label="Cómo pagar" className="inline-flex self-start rounded-xl bg-surface-2 p-1">
          {(['mensual', 'anual'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={periodo === p} onClick={() => setPeriodo(p)}
              className={`tap rounded-lg px-4 py-2 text-sm font-semibold ${periodo === p ? 'bg-surface text-ink shadow-tarjeta' : 'text-ink-3'}`}>
              {p === 'mensual' ? 'Por mes' : 'Por año · 2 meses de regalo'}
            </button>
          ))}
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
                className="h-12 w-24 rounded-xl border border-line bg-surface text-center font-display text-3xl font-bold tabular-nums outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
              />
              <button type="button" onClick={() => poner(unidades + 1)} aria-label="Una unidad más" className="tap grid size-12 place-items-center rounded-xl border border-line hover:border-ink-3">
                <Plus className="size-5" aria-hidden />
              </button>
              <span className="text-ink-3">unidades</span>
            </div>
            <input type="range" min={1} max={60} value={Math.min(unidades, 60)} onChange={(e) => poner(Number(e.target.value))} aria-label="Cantidad de unidades" className="w-full accent-[var(--accent)]" />
            <p className="text-xs text-ink-3">Cuenta cada vehículo con patente en servicio: camiones, tractores, semirremolques y acoplados.</p>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-xl bg-accent-soft p-5">
            <span className="eyebrow">Tu plan</span>
            <p aria-live="polite" className="font-display text-3xl font-bold">{plan.nombre}</p>
            <p className="text-ink-2">{precio(plan)}</p>
            {seCotiza(plan) ? (
              <Boton type="button" onClick={irAContacto} className="mt-2">Pedir una cotización</Boton>
            ) : (
              <BotonLink href={empezar}>Probar {DIAS_DE_PRUEBA} días gratis</BotonLink>
            )}
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {planes.map((p) => {
            const elegido = p.clave === plan.clave;
            return (
              <li key={p.clave} className={`flex flex-col gap-3 rounded-2xl border bg-surface p-5 ${elegido ? 'border-accent ring-2 ring-accent' : 'border-line'}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl font-bold">{p.nombre}</h3>
                  {elegido && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Tu plan</span>}
                </div>
                <p className="text-sm font-semibold text-ink-3">{alcance(p)}</p>
                <p>{precio(p)}</p>
                <p className="flex-1 text-ink-2">{p.bajada}</p>
                {seCotiza(p) ? (
                  <Boton type="button" variante="secundario" onClick={irAContacto}>Pedir cotización</Boton>
                ) : (
                  <BotonLink href={empezar} variante={elegido ? 'primario' : 'secundario'}>Probar gratis</BotonLink>
                )}
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
        <p className="text-sm text-ink-3">
          Precios en pesos argentinos, sin IVA. Se paga con tarjeta a través de Mercado Pago, por mes o por año. Sin permanencia: cambiás de plan o das de baja cuando quieras.
        </p>
      </section>

      <section id="contratar" aria-labelledby="titulo-contratar" className="flex scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-contratar" className="font-display text-3xl font-bold sm:text-4xl">¿Preferís que te contactemos?</h2>
          <p className="max-w-2xl text-ink-2">Para flotas de más de 40 unidades, o si querés que te ayudemos a arrancar, dejanos tus datos y te escribimos.</p>
        </div>
        <FormContacto cantidad={cantidad} setCantidad={setCantidad} plan={plan} />
      </section>
    </>
  );
}

function FormContacto({ cantidad, setCantidad, plan }: { cantidad: string; setCantidad: (v: string) => void; plan: Plan }) {
  const [estado, enviar] = useActionState<EstadoPedido, FormData>(solicitarContratacion, {});
  const formulario = useEnfocarError(estado.errores);
  if (estado.ok) {
    const { nombre, empresa, plan: nombrePlan, unidades } = estado.ok;
    return (
      <div role="status" className="aparecer flex flex-col items-start gap-3 rounded-2xl border border-ok bg-ok-soft p-6">
        <h3 className="font-display text-2xl font-bold">¡Gracias, {nombre}!</h3>
        <p>Recibimos el pedido de <b>{empresa}</b>: plan {nombrePlan}, {unidades} {unidades === 1 ? 'unidad' : 'unidades'}. Te vamos a escribir para ayudarte con el alta.</p>
        <p className="text-ink-2">Mientras tanto ya podés crear tu cuenta y empezar la prueba gratis.</p>
        <BotonLink href="/registrarse">Crear mi cuenta</BotonLink>
      </div>
    );
  }
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  const precio = precioDe(plan, 'mensual');
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
        ayuda={`Plan ${plan.nombre}${precio === null ? ': precio a cotizar' : `: ${pesos(precio)} por mes + IVA`}`}
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
