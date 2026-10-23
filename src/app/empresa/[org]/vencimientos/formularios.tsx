'use client';

import { Paperclip, RefreshCw, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Fotos, type EstadoFotos } from '@/components/fotos';
import { Aviso, Boton, Campo, Patente, Pildora } from '@/components/ui';
import { crearDocumento, eliminarDocumento, renovarDocumento, type EstadoDoc } from './acciones';

export type TipoDoc = { id: string; nombre: string; aplica: 'unidad' | 'chofer'; vigencia_meses: number; aviso_dias: number };

// Suma meses a una fecha AAAA-MM-DD (fin de mes incluido: 31/01 + 1 mes = 28/02).
export function sumarMeses(fecha: string, meses: number) {
  const [a, m, d] = fecha.split('-').map(Number);
  const objetivo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
  objetivo.setUTCDate(Math.min(d, ultimo));
  return objetivo.toISOString().slice(0, 10);
}

export function FormDocumento({ org, hoy, tipos, unidades, choferes }: {
  org: string; hoy: string; tipos: TipoDoc[]; unidades: { id: string; dominio: string }[]; choferes: { id: string; nombre: string }[];
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDoc, FormData>(crearDocumento.bind(null, org), {});
  const [titular, setTitular] = useState('');
  const [tipo, setTipo] = useState('');
  const [vence, setVence] = useState('');
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const clase = titular.startsWith('c:') ? 'chofer' : titular.startsWith('u:') ? 'unidad' : null;
  const disponibles = tipos.filter((t) => !clase || t.aplica === clase);
  const e = estado.errores ?? {};
  const control = 'w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent';

  return (
    <form key={estado.clave ?? 0} action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titular" className="text-sm font-semibold text-ink-2">Unidad o chofer</label>
          <select id="titular" name="titular" value={titular} onChange={(x) => { setTitular(x.target.value); setTipo(''); }} className={control}>
            <option value="">Elegí…</option>
            {unidades.length > 0 && <optgroup label="Unidades">{unidades.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.dominio}</option>)}</optgroup>}
            {choferes.length > 0 && <optgroup label="Choferes">{choferes.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.nombre}</option>)}</optgroup>}
          </select>
          {e.titular && <span className="text-xs font-semibold text-crit">{e.titular}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm font-semibold text-ink-2">Documento</label>
          <select id="tipo" name="tipo" value={tipo} onChange={(x) => {
            setTipo(x.target.value);
            const t = tipos.find((y) => y.id === x.target.value);
            if (t && !vence) setVence(sumarMeses(hoy, t.vigencia_meses));
          }} className={control}>
            <option value="">Elegí…</option>
            {disponibles.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          {e.tipo && <span className="text-xs font-semibold text-crit">{e.tipo}</span>}
        </div>
        <Campo label="Vence" name="vence" type="date" value={vence} onChange={(x) => setVence(x.target.value)} error={e.vence} />
        <Campo label="Número o póliza" name="numero" placeholder="Opcional" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink-2">Foto del documento <span className="font-normal text-ink-3">(opcional)</span></span>
        <Fotos org={org} carpeta="documentos" nombre="foto" maximo={1} etiqueta="Foto" alCambiar={setFotos} />
      </div>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div><Boton type="submit" disabled={enviando || fotos.subiendo}>{enviando ? 'Guardando…' : 'Agregar documento'}</Boton></div>
    </form>
  );
}

export type FilaDoc = {
  id: string; nombre: string; vence: string; dias: number; estado: 'vencido' | 'proximo' | 'ok';
  vigencia: number; titular: { clase: 'unidad' | 'chofer'; texto: string }; numero: string | null; fotoUrl: string | null;
};

const ESTADO = {
  vencido: { tono: 'crit', texto: (d: number) => (d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`) },
  proximo: { tono: 'warn', texto: (d: number) => (d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`) },
  ok: { tono: 'ok', texto: (d: number) => `En ${d} días` },
} as const;

// Fila con renovación en el lugar: la fecha nueva ya viene sugerida según la vigencia del documento.
export function FilaDocumento({ org, hoy, doc, edita }: { org: string; hoy: string; doc: FilaDoc; edita: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [estado, enviar, enviando] = useActionState<EstadoDoc, FormData>(renovarDocumento.bind(null, org, doc.id), {});
  const base = doc.vence > hoy ? doc.vence : hoy;
  const e = ESTADO[doc.estado];
  return (
    <li className="flex flex-col gap-2.5 border-b border-line py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{doc.nombre}{doc.numero && <span className="font-normal text-ink-3"> · {doc.numero}</span>}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {doc.titular.clase === 'unidad' ? <Patente dominio={doc.titular.texto} /> : <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">{doc.titular.texto}</span>}
            <span>Vence el {doc.vence.split('-').reverse().join('/')}</span>
          </div>
        </div>
        <Pildora tipo={e.tono}>{e.texto(doc.dias)}</Pildora>
      </div>
      {(edita || doc.fotoUrl) && (
        <div className="flex items-center gap-1">
          {edita && !estado.ok && (
            <button type="button" onClick={() => setAbierta(!abierta)} className={`tap flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${doc.estado === 'ok' ? 'border border-line text-ink-2 hover:bg-surface-2' : 'bg-accent text-accent-ink'}`}>
              <RefreshCw className="size-4" />Renovar
            </button>
          )}
          {doc.fotoUrl && <a href={doc.fotoUrl} target="_blank" rel="noreferrer" aria-label="Ver documento" className="tap grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"><Paperclip className="size-4" /></a>}
          {edita && (
            <form action={eliminarDocumento.bind(null, org, doc.id)} className="ml-auto" onSubmit={(x) => { if (!window.confirm(`¿Eliminar ${doc.nombre} de ${doc.titular.texto}?`)) x.preventDefault(); }}>
              <button aria-label="Eliminar documento" className="tap grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-crit-soft hover:text-crit"><Trash2 className="size-4" /></button>
            </form>
          )}
        </div>
      )}
      {estado.ok && <p className="aparecer text-sm font-semibold text-ok">Renovado. Ya figura con la fecha nueva.</p>}
      {abierta && !estado.ok && (
        <form action={enviar} className="aparecer flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3">
          <Campo label="Nuevo vencimiento" name="vence" type="date" defaultValue={sumarMeses(base, doc.vigencia)} error={estado.errores?.vence} />
          <Campo label="Número nuevo" name="numero" placeholder="Opcional" />
          <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>
          {estado.error && <span className="text-sm font-semibold text-crit">{estado.error}</span>}
        </form>
      )}
    </li>
  );
}
