'use client';

import { useActionState, useState } from 'react';
import { Fotos, type EstadoFotos } from '@/components/fotos';
import { Aviso, Boton, Campo, Seleccion } from '@/components/ui';
import { NOMBRE_CATEGORIA } from '@/lib/formato';
import { crearGasto, type EstadoGasto } from './acciones';

const CATEGORIAS = ['combustible', 'peaje', 'viatico', 'neumaticos', 'seguro', 'patente', 'multa', 'lavado', 'otro'];

// Carga rápida de gastos para la administración: lo obligatorio es categoría e importe.
export function FormGasto({ org, hoy, unidades, choferes }: { org: string; hoy: string; unidades: { id: string; dominio: string }[]; choferes: { id: string; nombre: string }[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoGasto, FormData>(crearGasto.bind(null, org), {});
  const [categoria, setCategoria] = useState('combustible');
  const [fotos, setFotos] = useState<EstadoFotos>({ rutas: [], subiendo: false });
  const e = estado.errores ?? {};
  return (
    <form key={estado.clave ?? 0} action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Seleccion label="Categoría" name="categoria" value={categoria} onChange={(x) => setCategoria(x.target.value)} opciones={CATEGORIAS.map((c) => ({ valor: c, texto: NOMBRE_CATEGORIA[c] }))} error={e.categoria} />
        <Campo label="Importe" name="monto" inputMode="decimal" placeholder="$ 0" error={e.monto} required />
        <Campo label="Fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} error={e.fecha} />
        {categoria === 'combustible'
          ? <Campo label="Litros" name="litros" inputMode="decimal" placeholder="180" error={e.litros} ayuda="Para calcular el consumo." />
          : <Campo label="Detalle" name="descripcion" placeholder="Póliza, VTV, multa…" />}
        <Seleccion label="Unidad" name="unidad" vacio="Sin unidad (gasto general)" opciones={unidades.map((u) => ({ valor: u.id, texto: u.dominio }))} />
        <Seleccion label="Chofer" name="chofer" vacio="Sin chofer" opciones={choferes.map((c) => ({ valor: c.id, texto: c.nombre }))} />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-ink-2">Comprobante <span className="font-normal text-ink-3">(opcional)</span></span>
          <Fotos org={org} carpeta="gastos" nombre="foto" maximo={1} etiqueta="Foto" alCambiar={setFotos} />
        </div>
      </div>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div><Boton type="submit" disabled={enviando || fotos.subiendo}>{enviando ? 'Guardando…' : fotos.subiendo ? 'Subiendo la foto…' : 'Agregar gasto'}</Boton></div>
    </form>
  );
}