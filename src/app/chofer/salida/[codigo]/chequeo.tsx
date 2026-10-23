'use client';

import { AlertOctagon, Check, CheckCheck, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { CampoKm, NivelCombustible } from '@/components/controles';
import { Fotos, type EstadoFotos } from '@/components/fotos';
import { AccionFija } from '@/components/movil';
import { iniciarViaje, type ResultadoSalida } from '../../acciones';

export type ItemChequeo = { clave: string; nombre: string; ayuda: string | null; critico: boolean };
type Respuesta = { estado: 'ok' | 'problema'; nota: string; fotos: string[]; subiendo: boolean };

export function Chequeo({ codigo, org, items, kmUltimo, dominio }: { codigo: string; org: string; items: ItemChequeo[]; kmUltimo: number | null; dominio: string }) {
  const [km, setKm] = useState('');
  const [combustible, setCombustible] = useState<number | null>(null);
  const [destino, setDestino] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
  const [resultado, setResultado] = useState<ResultadoSalida>({});
  const [senalado, setSenalado] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const responder = (clave: string, estado: 'ok' | 'problema') => {
    navigator.vibrate?.(8);
    setRespuestas((r) => ({ ...r, [clave]: { ...(r[clave] ?? { nota: '', fotos: [], subiendo: false }), estado } }));
  };
  // Una función fija por punto: si cambiara en cada render, el componente de fotos avisaría sin parar.
  const avisos = useRef<Record<string, (e: EstadoFotos) => void>>({});
  const fotosDe = (clave: string) =>
    (avisos.current[clave] ??= (e: EstadoFotos) =>
      setRespuestas((r) => (r[clave] ? { ...r, [clave]: { ...r[clave], fotos: e.rutas, subiendo: e.subiendo } } : r)));
  const todoBienLoQueFalta = () => {
    navigator.vibrate?.(15);
    setRespuestas((r) => Object.fromEntries(items.map((i) => [i.clave, r[i.clave] ?? { estado: 'ok', nota: '', fotos: [], subiendo: false }])));
  };

  const respondidos = items.filter((i) => respuestas[i.clave]).length;
  const criticos = items.filter((i) => i.critico && respuestas[i.clave]?.estado === 'problema');
  const subiendo = Object.values(respuestas).some((r) => r.subiendo);
  const kmValido = /^\d[\d.\s]*$/.test(km.trim());
  const falta = useMemo(() => {
    if (!kmValido) return 'Cargá el kilometraje';
    if (combustible === null) return 'Indicá el combustible';
    if (respondidos < items.length) return `Faltan ${items.length - respondidos} puntos por revisar`;
    if (subiendo) return 'Esperá que terminen de subir las fotos';
    return null;
  }, [kmValido, combustible, respondidos, items.length, subiendo]);

  // Si falta algo, el botón lleva hasta ahí y lo marca, en vez de quedar apagado sin explicar.
  function irAlFaltante() {
    const id = !kmValido ? 'km' : combustible === null ? 'nivel-combustible' : `item-${items.find((i) => !respuestas[i.clave])?.clave}`;
    const elemento = document.getElementById(id);
    elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (elemento instanceof HTMLInputElement) elemento.focus({ preventScroll: true });
    navigator.vibrate?.([10, 60, 10]);
    setSenalado(id);
    setTimeout(() => setSenalado(null), 1400);
  }

  function enviar() {
    if (falta) return irAlFaltante();
    iniciar(async () => {
      const r = await iniciarViaje(codigo, { km, combustible, destino, respuestas });
      if (r) setResultado(r);
    });
  }

  if (resultado.bloqueado) {
    return (
      <div className="aparecer flex flex-col items-center gap-4 px-6 pt-10 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-crit-soft text-crit"><AlertOctagon className="size-10" /></div>
        <h2 className="font-display text-3xl font-bold">No podés salir con {dominio}</h2>
        <p className="max-w-sm text-ink-2">
          Marcaste {resultado.bloqueado.fallas === 1 ? 'un problema crítico' : `${resultado.bloqueado.fallas} problemas críticos`}. Ya le avisamos al taller con tus fotos y la unidad quedó en reparación.
        </p>
        <Link href="/chofer" className="tap mt-2 flex h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-ink text-lg font-bold text-bg">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-40 pt-4">
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4">
        <h2 className="eyebrow">1 · Tablero</h2>
        <div className={senalado === 'km' ? 'senalar rounded-2xl' : ''}><CampoKm ultimo={kmUltimo} valor={km} alCambiar={setKm} /></div>
        <div id="nivel-combustible" className={senalado === 'nivel-combustible' ? 'senalar rounded-2xl' : ''}><NivelCombustible alCambiar={setCombustible} /></div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="destino" className="text-sm font-semibold text-ink-2">Destino <span className="font-normal text-ink-3">(opcional)</span></label>
          <input id="destino" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Rosario, planta Norte…" className="h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-transparent focus:ring-2 focus:ring-accent" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="eyebrow">2 · Revisá la unidad · {respondidos}/{items.length}</h2>
          {respondidos < items.length && (
            <button type="button" onClick={todoBienLoQueFalta} className="tap flex items-center gap-1 text-sm font-semibold text-ink-2">
              <CheckCheck className="size-4" />Lo que falta, bien
            </button>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(respondidos / items.length) * 100}%` }} />
        </div>

        {items.map((item) => {
          const r = respuestas[item.clave];
          const problema = r?.estado === 'problema';
          return (
            <div key={item.clave} id={`item-${item.clave}`}
              className={`scroll-mt-24 rounded-2xl border bg-surface p-3 transition-colors ${problema ? (item.critico ? 'border-crit' : 'border-warn') : r ? 'border-ok/50' : 'border-line'} ${senalado === `item-${item.clave}` ? 'senalar' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">
                    {item.nombre}
                    {item.critico && <ShieldAlert className="ml-1 inline size-4 align-[-2px] text-ink-3" aria-label="Punto crítico" />}
                  </p>
                  {item.ayuda && <p className="text-sm text-ink-3">{item.ayuda}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={item.nombre}>
                  <button type="button" role="radio" aria-checked={r?.estado === 'ok'} aria-label={`${item.nombre}: bien`} onClick={() => responder(item.clave, 'ok')}
                    className={`tap grid size-12 place-items-center rounded-xl border text-sm font-bold ${r?.estado === 'ok' ? 'border-ok bg-ok text-bg' : 'border-line text-ink-2'}`}>
                    <Check className="size-6" /><span className="sr-only">Bien</span>
                  </button>
                  <button type="button" role="radio" aria-checked={problema} aria-label={`${item.nombre}: tiene un problema`} onClick={() => responder(item.clave, 'problema')}
                    className={`tap grid size-12 place-items-center rounded-xl border text-sm font-bold ${problema ? (item.critico ? 'border-crit bg-crit text-bg' : 'border-warn bg-warn text-bg') : 'border-line text-ink-2'}`}>
                    <TriangleAlert className="size-6" /><span className="sr-only">Problema</span>
                  </button>
                </div>
              </div>
              {problema && (
                <div className="aparecer mt-3 flex flex-col gap-3 border-t border-line pt-3">
                  {item.critico && <p className="text-sm font-semibold text-crit">Es un punto crítico: con este problema no vas a poder salir.</p>}
                  <textarea
                    value={r.nota}
                    onChange={(e) => setRespuestas((x) => ({ ...x, [item.clave]: { ...x[item.clave], nota: e.target.value } }))}
                    rows={2}
                    placeholder="¿Qué pasa? Contalo en pocas palabras"
                    className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
                  />
                  <Fotos org={org} carpeta="fallas" alCambiar={fotosDe(item.clave)} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <AccionFija>
        {resultado.error && <p role="alert" className="aparecer rounded-2xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">{resultado.error}</p>}
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || subiendo}
          className={`tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold shadow-tarjeta disabled:opacity-70 ${
            falta ? 'border border-line bg-surface text-ink-2' : criticos.length ? 'bg-crit text-bg' : 'bg-accent text-accent-ink'}`}
        >
          {enviando ? <><Loader2 className="size-5 animate-spin" />Enviando…</> : falta ?? (criticos.length ? 'Avisar al taller' : 'Empezar viaje')}
        </button>
      </AccionFija>
    </div>
  );
}
