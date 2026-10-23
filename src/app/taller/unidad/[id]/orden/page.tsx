import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { FormAbrirOrden } from '../../../formularios';

export const metadata: Metadata = { title: 'Abrir orden' };

export default async function AbrirOrden({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizacion } = await contextoApp('taller');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const [{ data: u }, { data: fallas }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, marca, modelo').eq('id', id).eq('organizacion_id', organizacion.id).maybeSingle(),
    supabase.from('fallas').select('id, sistema, descripcion, gravedad').eq('unidad_id', id).eq('estado', 'abierta').order('creada_en'),
  ]);
  if (!u) notFound();
  return (
    <>
      <EncabezadoMovil titulo="Abrir orden" bajada="Para reparaciones que llevan tiempo" atras={`/taller/unidad/${u.id}`} accion={<Patente dominio={u.dominio} />} />
      <Pantalla>
        <FormAbrirOrden unidad={u.id} fallas={fallas ?? []} />
      </Pantalla>
    </>
  );
}
