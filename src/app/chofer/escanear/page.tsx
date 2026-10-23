import type { Metadata } from 'next';
import { Escaner } from '@/components/escaner';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { contextoApp } from '@/lib/apps';

export const metadata: Metadata = { title: 'Escanear unidad' };

export default async function EscanearChofer() {
  await contextoApp('chofer');
  return (
    <>
      <EncabezadoMovil titulo="Escanear unidad" atras="/chofer" />
      <Pantalla className="px-4 pt-4">
        <Escaner app="chofer" />
      </Pantalla>
    </>
  );
}
