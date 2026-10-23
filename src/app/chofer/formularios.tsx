'use client';

import { Banknote, CircleHelp, Fuel, Receipt, Ticket } from 'lucide-react';
import { useActionState, useState } from 'react';
import { BotonEnviar, CampoKm, conMiles, NivelCombustible } from '@/components/controles';
import { Fotos, type EstadoFotos } from '@/components/fotos';
import { AccionFija } from '@/components/movil';
import { cargarGasto, reportarFalla, terminarViaje, type EstadoForm } from './acciones';

// Los campos son controlados: si hay que corregir algo, lo escrito no se pierde.

const errorGeneral = (e: EstadoForm) =>
  e.error ? <p role="alert" className="aparecer rounded-2xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">{e.error}</p> : null;

const campo = (error?: string) =>
  `rounded-2xl border bg-surface px-4 outline-none focus:border-transparent focus:ring-2 focus:ring-accent ${error ? 'border-crit' : 'border-line'}`;

export function FormTerminar({ viaje, kmInicio }: { viaje: string; kmInicio: number }) {
  const [estado, enviar] = useActionState(terminarViaje.bind(null, viaje), {});
  const [km, setKm] = useState('');
  const [nota, setNota] = useState('');
  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <CampoKm etiqueta="Kilometraje de llegada" ultimo={kmInicio} valor={km} alCambiar={setKm} error={estado.errores?.km} />
      <NivelCombustible nombre="combustible" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="observaciones" className="text-sm font-semibold text-ink-2">Algo para contar <span className="font-normal text-ink-3">(opcional)</span></label>
        <textarea id="observaciones" name="observaciones" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Demoras, novedades de la carga…" className={`${campo()} py-3`} />
      </div>
      <AccionFija>
        {errorGeneral(estado)}
        <BotonEnviar pendiente="Terminando…">Terminar viaje</BotonEnviar>
      </AccionFija>
    </form>
  );
}

const CATEGORIAS = [
  { valor: 'combustible', texto: 'Combustible', icono: Fuel },
  { valor: 'peaje', texto: 'Peaje', icono: Ticket },
  { valor: 'viatico', texto: 'Viático', icono: Banknote },
  { valor: 'otro', texto: 'Otro', icono: Receipt },
];

export function FormGasto({ org, categoriaInicial }: { org: string; categoriaInicial: string }) {
  const [estado, enviar] = useActionState(cargarGasto, {});
  const [categoria, setCategoria] = useState(CATEGORIAS.some((c) => c.valor === categoriaInicial) ? categoriaInicial : 'combustible');
  const [monto, setMonto] = useState('');
  const [litros, setLitros] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const e = estado.errores ?? {};
  // Precio por litro mientras se escribe: un número raro avisa que hay un error de tipeo.
  const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
  const porLitro = numero(monto) > 0 && numero(litros) > 0 ? `$ ${Math.round(numero(monto) / numero(litros)).toLocaleString('es-AR')} por litro` : null;
  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-2">¿Qué pagaste?</legend>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIAS.map(({ valor, texto, icono: Icono }) => (
            <label key={valor} className={`tap flex cursor-pointer flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-semibold ${categoria === valor ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2'}`}>
              <input type="radio" name="categoria" value={valor} checked={categoria === valor} onChange={() => setCategoria(valor)} className="sr-only" />
              <Icono className="size-6" />{texto}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="monto" className="text-sm font-semibold text-ink-2">Importe</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-bold text-ink-3">$</span>
          <input id="monto" name="monto" inputMode="decimal" autoComplete="off" placeholder="0" value={monto} onChange={(x) => setMonto(conMiles(x.target.value, true))} aria-invalid={e.monto ? true : undefined}
            className={`h-16 w-full pl-11 font-display text-3xl font-bold ${campo(e.monto)}`} />
        </div>
        {e.monto && <span className="text-sm font-semibold text-crit">{e.monto}</span>}
      </div>
      {categoria === 'combustible' && (
        <div className="aparecer flex flex-col gap-1.5">
          <label htmlFor="litros" className="text-sm font-semibold text-ink-2">Litros <span className="font-normal text-ink-3">(para calcular el consumo)</span></label>
          <input id="litros" name="litros" inputMode="decimal" autoComplete="off" placeholder="0" value={litros} onChange={(x) => setLitros(conMiles(x.target.value, true))} aria-invalid={e.litros ? true : undefined}
            className={`h-14 text-xl font-semibold ${campo(e.litros)}`} />
          {e.litros ? <span className="text-sm font-semibold text-crit">{e.litros}</span> : porLitro && <span className="text-sm text-ink-3">{porLitro}</span>}
        </div>
      )}
      {categoria === 'otro' && (
        <div className="aparecer flex flex-col gap-1.5">
          <label htmlFor="descripcion" className="text-sm font-semibold text-ink-2">¿Qué fue?</label>
          <input id="descripcion" name="descripcion" placeholder="Lavado, gomería…" value={descripcion} onChange={(x) => setDescripcion(x.target.value)} className={`h-14 ${campo()}`} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-2">Foto del ticket <span className="font-normal text-ink-3">(recomendado)</span></span>
        <Fotos org={org} carpeta="gastos" nombre="foto" maximo={1} etiqueta="Ticket" alCambiar={setFotos} />
      </div>
      <AccionFija>
        {errorGeneral(estado)}
        <BotonEnviar deshabilitado={fotos.subiendo} pendiente="Guardando…">{fotos.subiendo ? 'Subiendo la foto…' : 'Guardar gasto'}</BotonEnviar>
      </AccionFija>
    </form>
  );
}

export function FormFalla({ org, unidad, sistemas }: { org: string; unidad: string; sistemas: { clave: string; nombre: string }[] }) {
  const [estado, enviar] = useActionState(reportarFalla, {});
  const [sistema, setSistema] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [grave, setGrave] = useState<'si' | 'no'>('no');
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <input type="hidden" name="unidad" value={unidad} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-2">¿Qué parte falla?</legend>
        <div className="flex flex-wrap gap-2">
          {sistemas.map((s) => (
            <label key={s.clave} className={`tap cursor-pointer rounded-full border px-4 py-2.5 text-sm font-semibold ${sistema === s.clave ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2'}`}>
              <input type="radio" name="sistema" value={s.clave} checked={sistema === s.clave} onChange={() => setSistema(s.clave)} className="sr-only" />
              {s.nombre}
            </label>
          ))}
        </div>
        {e.sistema && <span className="mt-2 block text-sm font-semibold text-crit">{e.sistema}</span>}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-semibold text-ink-2">¿Qué pasa?</label>
        <textarea id="descripcion" name="descripcion" rows={3} value={descripcion} onChange={(x) => setDescripcion(x.target.value)} placeholder="Ej.: ruido al frenar, se prende la luz de motor…" aria-invalid={e.descripcion ? true : undefined}
          className={`py-3 ${campo(e.descripcion)}`} />
        {e.descripcion && <span className="text-sm font-semibold text-crit">{e.descripcion}</span>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-2">Fotos</span>
        <Fotos org={org} carpeta="fallas" nombre="fotos" alCambiar={setFotos} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex items-center gap-1 text-sm font-semibold text-ink-2"><CircleHelp className="size-4" />¿Podés seguir viaje?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([['no', 'Sí, puedo seguir', 'border-ok bg-ok-soft text-ok'], ['si', 'No, es grave', 'border-crit bg-crit-soft text-crit']] as const).map(([valor, texto, activo]) => (
            <label key={valor} className={`tap flex cursor-pointer items-center justify-center rounded-2xl border py-3.5 font-semibold ${grave === valor ? activo : 'border-line bg-surface'}`}>
              <input type="radio" name="grave" value={valor} checked={grave === valor} onChange={() => setGrave(valor)} className="sr-only" />{texto}
            </label>
          ))}
        </div>
      </fieldset>
      <AccionFija>
        {errorGeneral(estado)}
        <BotonEnviar deshabilitado={fotos.subiendo} pendiente="Enviando…" variante={grave === 'si' ? 'peligro' : 'primario'}>
          {fotos.subiendo ? 'Subiendo fotos…' : grave === 'si' ? 'Avisar: es grave' : 'Avisar al taller'}
        </BotonEnviar>
      </AccionFija>
    </form>
  );
}
