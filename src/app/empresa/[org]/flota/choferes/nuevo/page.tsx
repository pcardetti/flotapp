import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Tarjeta } from '@/components/ui';
import { abrirSeccion, esGestor } from '@/lib/empresa';
import { crearChofer } from '../../acciones';
import { FormularioChofer } from '../../formularios';

export const metadata: Metadata = { title: 'Agregar chofer' };

export default async function NuevoChofer({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { rol } = await abrirSeccion(org, 'flota');
  if (!esGestor(rol)) notFound();
  return (
    <>
      <Link href={`/empresa/${org}/flota`} className="text-sm font-semibold text-accent hover:underline">← Flota y choferes</Link>
      <Encabezado titulo="Agregar chofer" />
      <Tarjeta className="max-w-3xl">
        <FormularioChofer accion={crearChofer.bind(null, org)} boton="Agregar chofer" cancelar={`/empresa/${org}/flota`} />
        <p className="text-sm text-ink-3">La unidad se le asigna desde la ficha de cada unidad, en Editar.</p>
      </Tarjeta>
    </>
  );
}
