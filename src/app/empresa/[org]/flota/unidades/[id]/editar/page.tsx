import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Patente, Tarjeta } from '@/components/ui';
import { UUID, abrirSeccion, esGestor } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { editarUnidad } from '../../../acciones';
import { FormularioUnidad } from '../../../formularios';

export const metadata: Metadata = { title: 'Editar unidad' };

export default async function EditarUnidad({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { rol } = await abrirSeccion(org, 'flota');
  if (!esGestor(rol) || !UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const [{ data: u }, { data: choferes }] = await Promise.all([
    supabase.from('unidades').select('dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, chofer_id, cargas_peligrosas').eq('id', id).eq('organizacion_id', org).maybeSingle(),
    supabase.from('choferes').select('id, nombre').eq('organizacion_id', org).order('nombre'),
  ]);
  if (!u) notFound();
  const volver = `/empresa/${org}/flota/unidades/${id}`;
  return (
    <>
      <Link href={volver} className="text-sm font-semibold text-accent hover:underline">← Volver a la unidad</Link>
      <Encabezado titulo={`Editar ${u.marca} ${u.modelo}`}>
        <Patente dominio={u.dominio} />
      </Encabezado>
      <Tarjeta className="max-w-3xl">
        <FormularioUnidad accion={editarUnidad.bind(null, org, id)} inicial={u} choferes={choferes ?? []} boton="Guardar cambios" cancelar={volver} />
        <p className="text-sm text-ink-3">Si corregís el kilometraje hacia abajo, queda anotado como corrección en el historial.</p>
      </Tarjeta>
    </>
  );
}
