import type { Metadata } from 'next';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { contextoApp } from '@/lib/apps';
import { FormGasto } from '../formularios';

export const metadata: Metadata = { title: 'Cargar gasto' };

export default async function CargarGasto({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const { organizacion } = await contextoApp('chofer');
  return (
    <>
      <EncabezadoMovil titulo="Cargar gasto" atras="/chofer" />
      <Pantalla>
        <FormGasto org={organizacion.id} categoriaInicial={categoria ?? 'combustible'} />
      </Pantalla>
    </>
  );
}
