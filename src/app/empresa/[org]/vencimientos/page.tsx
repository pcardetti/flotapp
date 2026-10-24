import { CalendarClock, FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Desplegable, Patente, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { diasHasta, hoyISO } from '@/lib/fechas';
import { firmarFotos } from '@/lib/fotos';
import { puede } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { FilaDocumento, FormDocumento, type FilaDoc, type TipoDoc } from './formularios';

export const metadata: Metadata = { title: 'Vencimientos' };

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

export default async function Vencimientos({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const empresa = await abrirSeccion(org, 'vencimientos');
  const supabase = await crearClienteServidor();
  const [{ data: docs, error }, { data: tipos }, { data: unidades }, { data: choferes }] = await Promise.all([
    supabase.from('documentos').select('id, tipo_documento_id, unidad_id, chofer_id, numero, vence, foto, unidad:unidades(dominio), chofer:choferes(nombre)').eq('organizacion_id', org).order('vence'),
    supabase.from('tipos_documento').select('id, nombre, aplica, vigencia_meses, aviso_dias').eq('organizacion_id', org).order('nombre'),
    supabase.from('unidades').select('id, dominio, tipo').eq('organizacion_id', org).neq('estado', 'baja').order('dominio'),
    supabase.from('choferes').select('id, nombre').eq('organizacion_id', org).order('nombre'),
  ]);
  avisarError('vencimientos', error);
  const hoy = hoyISO();
  const tipoPorId = new Map((tipos ?? []).map((t) => [t.id, t as TipoDoc]));
  const urls = await firmarFotos((docs ?? []).map((d) => d.foto));

  const filas: FilaDoc[] = (docs ?? []).map((d) => {
    const t = tipoPorId.get(d.tipo_documento_id);
    const dias = diasHasta(d.vence);
    return {
      id: d.id, nombre: t?.nombre ?? 'Documento', vence: d.vence, dias, vigencia: t?.vigencia_meses ?? 12,
      estado: dias < 0 ? 'vencido' : dias <= (t?.aviso_dias ?? 30) ? 'proximo' : 'ok',
      titular: d.unidad_id
        ? { clase: 'unidad', texto: uno(d.unidad as Uno<{ dominio: string }>)?.dominio ?? '—' }
        : { clase: 'chofer', texto: uno(d.chofer as Uno<{ nombre: string }>)?.nombre ?? '—' },
      numero: d.numero, fotoUrl: d.foto ? urls[d.foto] ?? null : null,
    };
  });
  const grupos = [
    { clave: 'vencido', titulo: 'Vencidos', filas: filas.filter((f) => f.estado === 'vencido') },
    { clave: 'proximo', titulo: 'Por vencer', filas: filas.filter((f) => f.estado === 'proximo') },
    { clave: 'ok', titulo: 'Al día', filas: filas.filter((f) => f.estado === 'ok') },
  ];

  // Qué falta cargar: cada unidad con cada documento de unidad. Los remolques no llevan tacógrafo.
  const tiposUnidad = (tipos ?? []).filter((t) => t.aplica === 'unidad');
  const conMotor = (tipo: string) => tipo === 'tractor' || tipo === 'chasis';
  const faltantes = (unidades ?? []).flatMap((u) =>
    tiposUnidad
      .filter((t) => conMotor(u.tipo) || !/tac[oó]grafo/i.test(t.nombre))
      .filter((t) => !(docs ?? []).some((d) => d.unidad_id === u.id && d.tipo_documento_id === t.id))
      .map((t) => ({ u, t })),
  );
  const edita = puede(empresa, 'vencimientos.editar');

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Vencimientos" bajada={`${grupos[0].filas.length} vencidos · ${grupos[1].filas.length} por vencer`} />
      {edita && (
        <Desplegable titulo="Agregar documento" abierto={!filas.length}>
          {tipos?.length ? (
            <FormDocumento org={org} hoy={hoy} tipos={(tipos ?? []) as TipoDoc[]} unidades={unidades ?? []} choferes={choferes ?? []} />
          ) : (
            <p className="text-sm text-ink-2">Primero definí los tipos de documento en <Link href={`/empresa/${org}/ajustes`} className="font-semibold text-accent hover:underline">Ajustes</Link>.</p>
          )}
        </Desplegable>
      )}

      {filas.length ? (
        grupos.filter((g) => g.filas.length).map((g) => (
          <Tarjeta key={g.clave}>
            <h2 className="font-display text-xl font-bold">{g.titulo} <span className="text-ink-3">· {g.filas.length}</span></h2>
            <ul className="flex flex-col">
              {g.filas.map((f) => <FilaDocumento key={f.id} org={org} hoy={hoy} doc={f} edita={edita} />)}
            </ul>
          </Tarjeta>
        ))
      ) : (
        !error && <Vacio titulo="Todavía no hay documentos"><span className="flex items-center gap-2"><CalendarClock className="size-5" />Cargá la RTO, el seguro y las licencias para recibir avisos antes de que venzan.</span></Vacio>
      )}

      {faltantes.length > 0 && (
        <Tarjeta>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><FileQuestion className="size-5 text-ink-3" />Sin cargar <span className="text-ink-3">· {faltantes.length}</span></h2>
          <ul className="flex flex-wrap gap-2">
            {faltantes.slice(0, 40).map(({ u, t }) => (
              <li key={`${u.id}-${t.id}`} className="flex items-center gap-2 rounded-xl border border-dashed border-line px-2.5 py-1.5 text-sm">
                <Patente dominio={u.dominio} /><span className="text-ink-2">{t.nombre}</span>
              </li>
            ))}
          </ul>
          {faltantes.length > 40 && <p className="text-sm text-ink-3">Y {faltantes.length - 40} más.</p>}
        </Tarjeta>
      )}
    </Pantalla>
  );
}
