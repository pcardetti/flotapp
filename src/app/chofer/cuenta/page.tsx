import type { Metadata } from 'next';
import { Cuenta } from '@/components/cuenta';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { contextoApp } from '@/lib/apps';

export const metadata: Metadata = { title: 'Cuenta' };

export default async function CuentaChofer() {
  const { usuario, organizacion } = await contextoApp('chofer');
  return (
    <>
      <EncabezadoMovil titulo="Cuenta" bajada={organizacion.nombre} />
      <Pantalla><Cuenta email={usuario.email} /></Pantalla>
    </>
  );
}
