import type { Metadata } from 'next';
import { Escaner } from '@/components/escaner';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { contextoApp } from '@/lib/apps';

export const metadata: Metadata = { title: 'Escanear unidad' };

export default async function EscanearTaller() {
  await contextoApp('taller');
  return (
    <>
      <EncabezadoMovil titulo="Escanear unidad" atras="/taller" />
      <Pantalla className="px-4 pt-4">
        <Escaner app="taller" />
      </Pantalla>
    </>
  );
}
