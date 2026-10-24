'use client';

import { Check, Trash2 } from 'lucide-react';
import { useActionState } from 'react';
import { BotonConfirmado } from '@/components/confirmar';
import { guardarTipo, eliminarTipo, type EstadoTipo } from './acciones';

export type Tipo = { id: string; nombre: string; aplica: string; vigencia_meses: number; aviso_dias: number; documentos: number };

const control = 'rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent';

// Cada tipo se edita en su propia fila; al guardar muestra una tilde.
export function FilaTipo({ org, tipo }: { org: string; tipo: Tipo | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoTipo, FormData>(guardarTipo.bind(null, org, tipo?.id ?? null), {});
  return (
    <form key={tipo ? undefined : estado.clave} action={enviar} className="grid grid-cols-2 items-end gap-2 border-b border-line py-3 last:border-0 md:grid-cols-[minmax(0,2fr)_9rem_7rem_7rem_auto]">
      <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
        <span className="text-xs font-semibold text-ink-3">Documento{tipo ? ` · ${tipo.documentos} cargados` : ''}</span>
        <input name="nombre" defaultValue={tipo?.nombre} placeholder="RTO, seguro, licencia…" className={control} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-3">Para</span>
        <select name="aplica" defaultValue={tipo?.aplica ?? 'unidad'} className={control}>
          <option value="unidad">Unidades</option>
          <option value="chofer">Choferes</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-3">Vigencia (meses)</span>
        <input name="vigencia_meses" type="number" min={1} max={120} defaultValue={tipo?.vigencia_meses ?? 12} className={control} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-3">Aviso (días antes)</span>
        <input name="aviso_dias" type="number" min={0} max={365} defaultValue={tipo?.aviso_dias ?? 30} className={control} />
      </label>
      <div className="col-span-2 flex items-center gap-1 md:col-span-1">
        <button disabled={enviando} className={`tap h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${tipo ? 'border border-line bg-surface hover:border-ink-3' : 'bg-accent text-accent-ink'}`}>
          {enviando ? '…' : tipo ? 'Guardar' : 'Agregar'}
        </button>
        {estado.ok && <Check className="aparecer size-5 text-ok" aria-label={estado.ok} />}
        {tipo && (
          // Borrar un tipo borra también sus documentos: la confirmación dice cuántos.
          <BotonConfirmado
            accion={eliminarTipo.bind(null, org, tipo.id)}
            pregunta={`¿Eliminar "${tipo.nombre}"?`}
            detalle={tipo.documentos ? `Se borran también ${tipo.documentos === 1 ? 'el documento cargado' : `los ${tipo.documentos} documentos cargados`} de este tipo. No se puede deshacer.` : 'No tiene documentos cargados.'}
            hecho="Tipo de documento eliminado"
            etiqueta={`Eliminar ${tipo.nombre}`}
            className="tap grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-crit-soft hover:text-crit"
          >
            <Trash2 className="size-4" />
          </BotonConfirmado>
        )}
      </div>
      {estado.error && <p className="col-span-full text-sm font-semibold text-crit">{estado.error}</p>}
    </form>
  );
}
