import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Patente, Tarjeta } from '@/components/ui';
import { UUID, abrirSeccion } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { SISTEMAS_FALLA } from '@/lib/taller';
import { reportarFalla } from '../../../acciones';
import { FormularioFalla } from '../../../formularios';

export const metadata: Metadata = { title: 'Reportar falla' };

export default async function ReportarFalla({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  await abrirSeccion(org, 'flota', 'flota.editar');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.from('unidades').select('dominio, marca, modelo').eq('id', id).eq('organizacion_id', org).maybeSingle();
  if (!u) notFound();
  const volver = `/empresa/${org}/flota/unidades/${id}`;
  return (
    <>
      <Link href={volver} className="text-sm font-semibold text-accent hover:underline">← Volver a la unidad</Link>
      <Encabezado titulo="Reportar falla" bajada={`${u.marca} ${u.modelo}`}>
        <Patente dominio={u.dominio} />
      </Encabezado>
      <Tarjeta className="max-w-3xl">
        <FormularioFalla accion={reportarFalla.bind(null, org, id)} org={org} sistemas={SISTEMAS_FALLA} cancelar={volver} />
        <p className="text-sm text-ink-3">La falla aparece en el taller y en la app del mecánico. Si es crítica, la unidad no puede salir hasta que se resuelva.</p>
      </Tarjeta>
    </>
  );
}
