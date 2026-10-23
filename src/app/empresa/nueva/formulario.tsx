'use client';

import { useActionState } from 'react';
import { Aviso, Boton, Campo } from '@/components/ui';
import { crearEmpresa, type EstadoAlta } from './acciones';

const OPCIONES = [
  { tipo: 'flota', titulo: 'Flota de transporte', detalle: 'Tengo camiones y quiero llevar su mantenimiento.' },
  { tipo: 'taller', titulo: 'Taller', detalle: 'Reparo o hago services para flotas.' },
  { tipo: 'recapadora', titulo: 'Recapadora', detalle: 'Recapo neumáticos para flotas.' },
] as const;

export function FormularioEmpresa() {
  const [estado, accion, enviando] = useActionState<EstadoAlta, FormData>(crearEmpresa, {});
  return (
    <form action={accion} className="flex flex-col gap-6">
      <Campo label="Nombre de la empresa" name="nombre" required defaultValue={estado.nombre} placeholder="Transporte del Sur S.A." autoComplete="organization" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">¿Qué tipo de empresa es?</legend>
        {OPCIONES.map((o) => (
          <label key={o.tipo} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name="tipo" value={o.tipo} defaultChecked={(estado.tipo ?? 'flota') === o.tipo} className="mt-1 size-4 accent-[var(--accent)]" />
            <span className="flex flex-col">
              <b>{o.titulo}</b>
              <span className="text-sm text-ink-2">{o.detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear empresa'}</Boton>
    </form>
  );
}
