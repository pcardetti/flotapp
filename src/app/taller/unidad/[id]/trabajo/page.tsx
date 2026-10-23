import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { UUID } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { FormTrabajo } from '../../../formularios';

export const metadata: Metadata = { title: 'Registrar trabajo' };

export default async function RegistrarTrabajo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ falla?: string }> }) {
  const { id } = await params;
  const { falla } = await searchParams;
  const { organizacion } = await contextoApp('taller');
  if (!UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const [{ data: u }, { data: fallas }] = await Promise.all([
    supabase.from('unidades').select('id, dominio, marca, modelo, km').eq('id', id).eq('organizacion_id', organizacion.id).maybeSingle(),
    supabase.from('fallas').select('id, sistema, descripcion, gravedad').eq('unidad_id', id).eq('estado', 'abierta').order('gravedad', { ascending: false }).order('creada_en'),
  ]);
  if (!u) notFound();
  return (
    <>
      <EncabezadoMovil titulo="Registrar trabajo" bajada={`${u.marca} ${u.modelo}`} atras={`/taller/unidad/${u.id}`} accion={<Patente dominio={u.dominio} />} />
      <Pantalla>
        <FormTrabajo unidad={u.id} org={organizacion.id} fallas={fallas ?? []} preelegida={falla && UUID.test(falla) ? falla : undefined} kmUltimo={u.km} />
      </Pantalla>
    </>
  );
}
