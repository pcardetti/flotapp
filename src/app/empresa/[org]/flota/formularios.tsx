'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Aviso, Boton, BotonLink, Campo, Casilla, Seleccion } from '@/components/ui';
import { ESTADOS_UNIDAD, JURISDICCIONES, TIPOS_UNIDAD, tieneMotor } from '@/lib/flota';
import type { EstadoForm } from './acciones';

type Accion = (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;

export type UnidadInicial = {
  dominio: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  km: number | null;
  jurisdiccion: string;
  estado: string;
  chofer_id: string | null;
  cargas_peligrosas: boolean;
};

const opciones = (o: Record<string, string>) => Object.entries(o).map(([valor, texto]) => ({ valor, texto }));

export function FormularioUnidad({ accion, inicial, choferes, boton, cancelar }: { accion: Accion; inicial?: UnidadInicial; choferes: { id: string; nombre: string }[]; boton: string; cancelar: string }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  // Después de un error se muestran los valores que se enviaron; si no, los guardados.
  const val = (k: keyof UnidadInicial) => (estado.valores ? (estado.valores[k] ?? '') : inicial?.[k] == null ? '' : String(inicial[k]));
  const [tipo, setTipo] = useState(val('tipo') || 'tractor');
  const e = estado.errores ?? {};
  const motor = tieneMotor(tipo);

  return (
    <form key={estado.clave ?? 0} action={enviar} className="flex flex-col gap-5">
      {estado.error && !e.dominio && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.subirPlan && <div><BotonLink href={estado.subirPlan}>Ver planes</BotonLink></div>}
      {Object.keys(e).length > 0 && <Aviso tipo="error">Revisá los campos marcados.</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Patente" name="dominio" defaultValue={val('dominio')} error={e.dominio} ayuda="Mercosur (AF 123 KD) o anterior (OPQ 318)." autoCapitalize="characters" autoComplete="off" required />
        <Seleccion label="Tipo" name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value)} opciones={opciones(TIPOS_UNIDAD)} error={e.tipo} />
        <Campo label="Marca" name="marca" defaultValue={val('marca')} error={e.marca} placeholder="Mercedes-Benz, Scania, Iveco…" required />
        <Campo label="Modelo" name="modelo" defaultValue={val('modelo')} error={e.modelo} placeholder="Actros 2046" required />
        <Campo label="Año" name="anio" defaultValue={val('anio')} error={e.anio} inputMode="numeric" placeholder="2021" />
        <Campo
          label={motor ? 'Kilometraje del tablero' : 'Kilometraje (opcional)'}
          name="km"
          defaultValue={val('km')}
          error={e.km}
          inputMode="numeric"
          placeholder="412300"
          ayuda={motor ? 'Sólo números. Podés usar puntos de miles.' : 'Los remolques suelen no tener odómetro.'}
          required={motor}
        />
        <Seleccion label="Jurisdicción" name="jurisdiccion" defaultValue={val('jurisdiccion') || 'Nacional'} opciones={JURISDICCIONES.map((j) => ({ valor: j, texto: j }))} error={e.jurisdiccion} />
        <Seleccion label="Estado" name="estado" defaultValue={val('estado') || 'operativa'} opciones={opciones(ESTADOS_UNIDAD)} error={e.estado} />
        <Seleccion
          label="Chofer asignado"
          name="chofer_id"
          defaultValue={val('chofer_id')}
          vacio="Sin asignar"
          opciones={choferes.map((c) => ({ valor: c.id, texto: c.nombre }))}
          error={e.chofer_id}
          ayuda={choferes.length ? undefined : 'Todavía no cargaste choferes.'}
        />
      </div>
      <Casilla
        label="Transporta cargas peligrosas"
        name="cargas_peligrosas"
        defaultChecked={estado.valores ? estado.valores.cargas_peligrosas === 'on' : Boolean(inicial?.cargas_peligrosas)}
        ayuda="Sirve para pedir la habilitación y los cursos que corresponden."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : boton}</Boton>
        <Link href={cancelar} className="text-sm font-semibold text-ink-2 hover:underline">Cancelar</Link>
      </div>
    </form>
  );
}

export function FormularioChofer({ accion, inicial, boton, cancelar }: { accion: Accion; inicial?: { nombre: string; telefono: string | null }; boton: string; cancelar: string }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const val = (k: 'nombre' | 'telefono') => (estado.valores ? (estado.valores[k] ?? '') : (inicial?.[k] ?? ''));
  const e = estado.errores ?? {};
  return (
    <form key={estado.clave ?? 0} action={enviar} className="flex flex-col gap-5">
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre y apellido" name="nombre" defaultValue={val('nombre')} error={e.nombre} autoComplete="off" required />
        <Campo label="Teléfono" name="telefono" defaultValue={val('telefono')} error={e.telefono} inputMode="tel" placeholder="+54 9 341 555-0000" ayuda="Opcional." />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : boton}</Boton>
        <Link href={cancelar} className="text-sm font-semibold text-ink-2 hover:underline">Cancelar</Link>
      </div>
    </form>
  );
}

export function FormularioKm({ accion }: { accion: Accion }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  return (
    <form key={estado.clave ?? 0} action={enviar} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Campo label="Kilometraje de hoy" name="km" inputMode="numeric" placeholder="412800" defaultValue={estado.valores?.km} error={estado.errores?.km} className="w-48" required />
        <Boton type="submit" disabled={enviando} className="mb-[1px]">{enviando ? 'Guardando…' : 'Registrar'}</Boton>
      </div>
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
    </form>
  );
}

// Eliminar pide una segunda confirmación en la misma pantalla.
export function Eliminar({ accion, boton, pregunta, detalle }: { accion: () => Promise<EstadoForm>; boton: string; pregunta: string; detalle: string }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) return <div><Boton type="button" variante="secundario" onClick={() => setConfirmando(true)}>{boton}</Boton></div>;
  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-xl border border-crit bg-crit-soft p-4">
      <p className="font-semibold text-crit">{pregunta}</p>
      <p className="text-sm text-ink-2">{detalle}</p>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="peligro" disabled={enviando}>{enviando ? 'Eliminando…' : 'Sí, eliminar'}</Boton>
        <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>Cancelar</Boton>
      </div>
    </form>
  );
}
