import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { ListaVinculos } from '@/components/lista-vinculos';
import { abrirSeccion } from '@/lib/empresa';

export const metadata: Metadata = { title: 'Talleres y recapadoras' };

export default async function Proveedores({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await abrirSeccion(org, 'proveedores');
  return (
    <>
      <Encabezado titulo="Talleres y recapadoras" bajada="Proveedores vinculados a tu flota" />
      <ListaVinculos org={org} lado="flota" />
    </>
  );
}
