import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { ListaVinculos } from '@/components/lista-vinculos';
import { abrirSeccion } from '@/lib/empresa';

export const metadata: Metadata = { title: 'Flotas clientes' };

export default async function Clientes({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await abrirSeccion(org, 'clientes');
  return (
    <>
      <Encabezado titulo="Flotas clientes" bajada="Flotas que te derivan trabajo" />
      <ListaVinculos org={org} lado="proveedor" />
    </>
  );
}
