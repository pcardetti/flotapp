import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { Patente, Tarjeta } from '@/components/ui';
import { UUID, abrirSeccion, esGestor } from '@/lib/empresa';
import { crearClienteServidor } from '@/lib/supabase/server';
import { editarChofer, eliminarChofer } from '../../acciones';
import { Eliminar, FormularioChofer } from '../../formularios';

export const metadata: Metadata = { title: 'Chofer' };

export default async function Chofer({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { rol } = await abrirSeccion(org, 'flota');
  if (!esGestor(rol) || !UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const [{ data: c }, { data: unidades }] = await Promise.all([
    supabase.from('choferes').select('nombre, telefono').eq('id', id).eq('organizacion_id', org).maybeSingle(),
    supabase.from('unidades').select('id, dominio, marca, modelo').eq('organizacion_id', org).eq('chofer_id', id).order('dominio'),
  ]);
  if (!c) notFound();
  const base = `/empresa/${org}/flota`;
  return (
    <>
      <Link href={base} className="text-sm font-semibold text-accent hover:underline">← Flota y choferes</Link>
      <Encabezado titulo={c.nombre} bajada="Chofer" />
      <Tarjeta className="max-w-3xl">
        <FormularioChofer accion={editarChofer.bind(null, org, id)} inicial={c} boton="Guardar cambios" cancelar={base} />
      </Tarjeta>
      <Tarjeta className="max-w-3xl">
        <h2 className="font-display text-xl font-bold">Unidades asignadas</h2>
        {unidades?.length ? (
          <ul className="flex flex-col gap-2">
            {unidades.map((u) => (
              <li key={u.id}>
                <Link href={`${base}/unidades/${u.id}`} className="flex items-center gap-2.5 hover:underline">
                  <Patente dominio={u.dominio} /> {u.marca} {u.modelo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No tiene unidades asignadas. Se asignan desde Editar, en la ficha de cada unidad.</p>
        )}
      </Tarjeta>
      <Tarjeta className="max-w-3xl border-dashed">
        <h2 className="font-display text-xl font-bold">Eliminar chofer</h2>
        <Eliminar
          accion={eliminarChofer.bind(null, org, id)}
          boton="Eliminar chofer"
          pregunta={`¿Eliminar a ${c.nombre}?`}
          detalle="Sus unidades quedan sin chofer asignado y se borran sus documentos (licencias y cursos). No se puede deshacer."
        />
      </Tarjeta>
    </>
  );
}
