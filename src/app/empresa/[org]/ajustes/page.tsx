import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { FilaTipo, type Tipo } from './formularios';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function Ajustes({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await abrirSeccion(org, 'ajustes');
  const supabase = await crearClienteServidor();
  const [{ data: tipos, error }, { data: docs }] = await Promise.all([
    supabase.from('tipos_documento').select('id, nombre, aplica, vigencia_meses, aviso_dias').eq('organizacion_id', org).order('aplica').order('nombre'),
    supabase.from('documentos').select('tipo_documento_id').eq('organizacion_id', org),
  ]);
  avisarError('ajustes', error);
  const usados = new Map<string, number>();
  for (const d of docs ?? []) usados.set(d.tipo_documento_id, (usados.get(d.tipo_documento_id) ?? 0) + 1);

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Ajustes" bajada="Tipos de documento y sus plazos" />
      <Tarjeta>
        <div>
          <h2 className="font-display text-xl font-bold">Tipos de documento</h2>
          <p className="text-sm text-ink-3">La vigencia sugiere la fecha al renovar; el aviso define cuándo aparece como «por vencer». La normativa cambia: revisá los plazos de tu jurisdicción.</p>
        </div>
        <div>
          {(tipos ?? []).map((t) => <FilaTipo key={t.id} org={org} tipo={{ ...t, documentos: usados.get(t.id) ?? 0 } as Tipo} />)}
          <FilaTipo org={org} tipo={null} />
        </div>
      </Tarjeta>
    </Pantalla>
  );
}
