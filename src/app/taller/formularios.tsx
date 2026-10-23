'use client';

import { Check, Wrench, Droplets } from 'lucide-react';
import { useActionState, useState } from 'react';
import { BotonEnviar, conMiles } from '@/components/controles';
import { Fotos, type EstadoFotos } from '@/components/fotos';
import { AccionFija } from '@/components/movil';
import { nombreSistema } from '@/lib/taller';
import { abrirOrden, cerrarOrden, registrarTrabajo, type EstadoForm } from './acciones';

export type FallaElegible = { id: string; sistema: string; descripcion: string | null; gravedad: string };

const campo = (error?: string) =>
  `w-full rounded-2xl border bg-surface px-4 outline-none focus:border-transparent focus:ring-2 focus:ring-accent ${error ? 'border-crit' : 'border-line'}`;

function MensajeError({ texto }: { texto?: string }) {
  return texto ? <span className="text-sm font-semibold text-crit">{texto}</span> : null;
}

function ErrorGeneral({ estado }: { estado: EstadoForm }) {
  return estado.error ? <p role="alert" className="aparecer rounded-2xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">{estado.error}</p> : null;
}

// Importes y kilometraje: los campos de costo que comparten los formularios del taller.
function Costos({ errores, kmUltimo }: { errores: Record<string, string>; kmUltimo: number | null }) {
  const [repuestos, setRepuestos] = useState('');
  const [manoObra, setManoObra] = useState('');
  const [km, setKm] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {([['repuestos', 'Repuestos', repuestos, setRepuestos], ['mano_obra', 'Mano de obra', manoObra, setManoObra]] as const).map(([nombre, etiqueta, valor, set]) => (
          <div key={nombre} className="flex flex-col gap-1.5">
            <label htmlFor={nombre} className="text-sm font-semibold text-ink-2">{etiqueta}</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-ink-3">$</span>
              <input id={nombre} name={nombre} inputMode="decimal" autoComplete="off" placeholder="0" value={valor} onChange={(e) => set(conMiles(e.target.value, true))} className={`h-14 pl-7 text-lg font-semibold ${campo(errores[nombre])}`} />
            </div>
            <MensajeError texto={errores[nombre]} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="km" className="text-sm font-semibold text-ink-2">Kilometraje <span className="font-normal text-ink-3">(opcional)</span></label>
        <input id="km" name="km" inputMode="numeric" autoComplete="off" value={km} onChange={(e) => setKm(conMiles(e.target.value))} className={`h-14 text-lg font-semibold ${campo(errores.km)}`} />
        {errores.km ? <MensajeError texto={errores.km} /> : kmUltimo != null && <span className="text-xs text-ink-3">Último registrado: {kmUltimo.toLocaleString('es-AR')} km</span>}
      </div>
    </div>
  );
}

function ElegirFallas({ fallas, elegidas, alCambiar }: { fallas: FallaElegible[]; elegidas: string[]; alCambiar: (ids: string[]) => void }) {
  if (!fallas.length) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-2">Fallas que quedan resueltas</legend>
      {fallas.map((f) => {
        const activa = elegidas.includes(f.id);
        return (
          <label key={f.id} className={`tap flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${activa ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
            <input type="checkbox" name="fallas" value={f.id} checked={activa} onChange={() => alCambiar(activa ? elegidas.filter((x) => x !== f.id) : [...elegidas, f.id])} className="sr-only" />
            <span className={`grid size-7 shrink-0 place-items-center rounded-lg border ${activa ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>{activa && <Check className="size-4" />}</span>
            <span className="min-w-0 flex-1">
              <b className="block leading-tight">{nombreSistema(f.sistema)}</b>
              {f.descripcion && f.descripcion !== nombreSistema(f.sistema) && <span className="text-sm text-ink-3">{f.descripcion}</span>}
            </span>
            {f.gravedad === 'critica' && <span className="text-xs font-bold uppercase text-crit">Crítica</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

const RAPIDOS = {
  preventivo: ['Cambio de aceite y filtros', 'Engrase general', 'Filtro de aire', 'Revisión de frenos', 'Alineación y balanceo'],
  correctivo: [],
} as const;

export function FormTrabajo({ unidad, org, fallas, preelegida, kmUltimo }: { unidad: string; org: string; fallas: FallaElegible[]; preelegida?: string; kmUltimo: number | null }) {
  const [estado, enviar] = useActionState(registrarTrabajo.bind(null, unidad), {});
  const inicial = fallas.find((f) => f.id === preelegida);
  const [tipo, setTipo] = useState<'correctivo' | 'preventivo'>(fallas.length ? 'correctivo' : 'preventivo');
  // Desde una falla, el trabajo arranca con un nombre que alcanza para guardar en un toque (y se puede cambiar).
  const [descripcion, setDescripcion] = useState(inicial ? `Reparación de ${nombreSistema(inicial.sistema).toLowerCase()}` : '');
  const [trabajo, setTrabajo] = useState('');
  const [elegidas, setElegidas] = useState<string[]>(preelegida ? [preelegida] : []);
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const e = estado.errores ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Tipo de trabajo">
        {([['correctivo', 'Reparación', Wrench], ['preventivo', 'Mantenimiento', Droplets]] as const).map(([valor, texto, Icono]) => (
          <button key={valor} type="button" role="radio" aria-checked={tipo === valor} onClick={() => setTipo(valor)}
            className={`tap flex h-12 items-center justify-center gap-2 rounded-xl font-semibold ${tipo === valor ? 'bg-surface text-ink shadow-tarjeta' : 'text-ink-3'}`}>
            <Icono className="size-5" />{texto}
          </button>
        ))}
      </div>

      <ElegirFallas fallas={fallas} elegidas={elegidas} alCambiar={setElegidas} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-semibold text-ink-2">Trabajo</label>
        <input id="descripcion" name="descripcion" value={descripcion} onChange={(x) => setDescripcion(x.target.value)} placeholder={tipo === 'preventivo' ? 'Cambio de aceite y filtros' : 'Cambio de pulmón de freno'} className={`h-14 ${campo(e.descripcion)}`} />
        <MensajeError texto={e.descripcion} />
        {tipo === 'preventivo' && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {RAPIDOS.preventivo.map((r) => (
              <button key={r} type="button" onClick={() => setDescripcion(r)} className={`tap rounded-full border px-3 py-1.5 text-sm font-semibold ${descripcion === r ? 'border-accent bg-accent-soft' : 'border-line bg-surface text-ink-2'}`}>{r}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trabajo" className="text-sm font-semibold text-ink-2">Detalle <span className="font-normal text-ink-3">(opcional)</span></label>
        <textarea id="trabajo" name="trabajo" rows={2} value={trabajo} onChange={(x) => setTrabajo(x.target.value)} placeholder="Repuestos usados, observaciones…" className={`py-3 ${campo()}`} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-2">Fotos del trabajo</span>
        <Fotos org={org} carpeta="ordenes" nombre="fotos" alCambiar={setFotos} />
      </div>

      <Costos errores={e} kmUltimo={kmUltimo} />

      <AccionFija>
        <ErrorGeneral estado={estado} />
        <BotonEnviar deshabilitado={fotos.subiendo} pendiente="Guardando…">
          {fotos.subiendo ? 'Subiendo fotos…' : elegidas.length ? `Guardar y resolver ${elegidas.length === 1 ? 'la falla' : `${elegidas.length} fallas`}` : 'Guardar trabajo'}
        </BotonEnviar>
      </AccionFija>
    </form>
  );
}

export function FormAbrirOrden({ unidad, fallas }: { unidad: string; fallas: FallaElegible[] }) {
  const [estado, enviar] = useActionState(abrirOrden.bind(null, unidad), {});
  const [descripcion, setDescripcion] = useState('');
  const [elegidas, setElegidas] = useState<string[]>(fallas.map((f) => f.id));
  const [parada, setParada] = useState(true);
  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <input type="hidden" name="parada" value={parada ? 'si' : 'no'} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-semibold text-ink-2">¿Qué hay que hacer?</label>
        <input id="descripcion" name="descripcion" value={descripcion} onChange={(x) => setDescripcion(x.target.value)} placeholder="Cambio de embrague" className={`h-14 ${campo(estado.errores?.descripcion)}`} />
        <MensajeError texto={estado.errores?.descripcion} />
      </div>
      <ElegirFallas fallas={fallas} elegidas={elegidas} alCambiar={setElegidas} />
      <button type="button" role="switch" aria-checked={parada} onClick={() => setParada(!parada)} className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left">
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${parada ? 'bg-accent' : 'bg-surface-2'}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${parada ? 'left-6' : 'left-1'}`} />
        </span>
        <span><b className="block">La unidad queda parada</b><span className="text-sm text-ink-3">Nadie puede salir con ella hasta cerrar la orden.</span></span>
      </button>
      <AccionFija>
        <ErrorGeneral estado={estado} />
        <BotonEnviar pendiente="Abriendo…">Abrir orden</BotonEnviar>
      </AccionFija>
    </form>
  );
}

export function FormCerrarOrden({ orden, unidad, org, kmUltimo }: { orden: string; unidad: string; org: string; kmUltimo: number | null }) {
  const [estado, enviar] = useActionState(cerrarOrden.bind(null, orden, unidad), {});
  const [trabajo, setTrabajo] = useState('');
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="flex flex-col gap-5 px-4 pb-40 pt-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="trabajo" className="text-sm font-semibold text-ink-2">¿Qué se hizo?</label>
        <textarea id="trabajo" name="trabajo" rows={3} value={trabajo} onChange={(x) => setTrabajo(x.target.value)} placeholder="Embrague nuevo, se reguló el pedal…" className={`py-3 ${campo(e.trabajo)}`} />
        <MensajeError texto={e.trabajo} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-2">Fotos del trabajo</span>
        <Fotos org={org} carpeta="ordenes" nombre="fotos" alCambiar={setFotos} />
      </div>
      <Costos errores={e} kmUltimo={kmUltimo} />
      <AccionFija>
        <ErrorGeneral estado={estado} />
        <BotonEnviar deshabilitado={fotos.subiendo} pendiente="Cerrando…">{fotos.subiendo ? 'Subiendo fotos…' : 'Cerrar orden'}</BotonEnviar>
      </AccionFija>
    </form>
  );
}
