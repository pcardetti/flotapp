import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Tarjeta } from '@/components/ui';
import { abrirSeccion, esGestor } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearUnidad } from '../../acciones';
import { FormularioUnidad } from '../../formularios';

export const metadata: Metadata = { title: 'Agregar unidad' };

export default async function NuevaUnidad({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { rol } = await abrirSeccion(org, 'flota');
  if (!esGestor(rol)) notFound();
  const supabase = await crearClienteServidor();
  const { data: choferes } = await supabase.from('choferes').select('id, nombre').eq('organizacion_id', org).order('nombre');
  return (
    <>
      <Link href={`/empresa/${org}/flota`} className="text-sm font-semibold text-accent hover:underline">← Flota y choferes</Link>
      <Encabezado titulo="Agregar unidad" bajada="Tractor, chasis, semirremolque o acoplado" />
      <Tarjeta className="max-w-3xl">
        <FormularioUnidad accion={crearUnidad.bind(null, org)} choferes={choferes ?? []} boton="Agregar unidad" cancelar={`/empresa/${org}/flota`} />
      </Tarjeta>
    </>
  );
}
