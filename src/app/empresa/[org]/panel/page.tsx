import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { fechaLarga } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { TableroFlota } from './tablero';

export const metadata: Metadata = { title: 'Tablero' };

export default async function Panel({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ p?: string }> }) {
  const { org } = await params;
  const { p } = await searchParams;
  const { organizacion, rol } = await abrirSeccion(org, 'panel');
  if (organizacion.tipo === 'flota') {
    return <Pantalla className="flex flex-col gap-5"><TableroFlota org={org} periodo={p ?? 'mes'} /></Pantalla>;
  }

  // Talleres y recapadoras: trabajo pendiente de sus flotas clientes.
  const supabase = await crearClienteServidor();
  const contar = async (consulta: PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>) => {
    const { count, error } = await consulta;
    avisarError('panel', error);
    return error ? null : (count ?? 0);
  };
  const [clientes, pendientes, trabajo] = await Promise.all([
    contar(supabase.from('vinculos_proveedor').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).eq('estado', 'activo')),
    contar(supabase.from('vinculos_proveedor').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).eq('estado', 'pendiente')),
    organizacion.tipo === 'taller'
      ? contar(supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).neq('estado', 'cerrada'))
      : contar(supabase.from('neumaticos').select('*', { count: 'exact', head: true }).eq('proveedor_actual_id', org)),
  ]);
  const datos = [
    organizacion.tipo === 'taller'
      ? { titulo: 'Trabajos en curso', valor: trabajo, detalle: 'Órdenes derivadas por tus clientes', ruta: 'trabajos' }
      : { titulo: 'Neumáticos recibidos', valor: trabajo, detalle: 'Esperando recapado', ruta: 'recapados' },
    { titulo: 'Flotas clientes', valor: clientes, detalle: 'Con vínculo activo', ruta: 'clientes' },
    { titulo: 'Invitaciones', valor: pendientes, detalle: 'Flotas que esperan tu respuesta', ruta: 'clientes', alerta: (pendientes ?? 0) > 0 },
  ];

  return (
    <Pantalla className="flex flex-col gap-6">
      <Encabezado titulo={organizacion.nombre} bajada={fechaLarga()} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {datos.map((d) => (
          <Link key={d.titulo} href={`/empresa/${org}/${d.ruta}`} className={`tap flex flex-col gap-1 rounded-xl border bg-surface px-4 py-3.5 hover:border-ink-3 ${d.alerta ? 'border-crit' : 'border-line'}`}>
            <span className="eyebrow">{d.titulo}</span>
            <span className="font-display text-4xl font-bold leading-none">{d.valor ?? '—'}</span>
            <span className="text-sm text-ink-2">{d.detalle}</span>
          </Link>
        ))}
      </div>
      {rol === 'admin' && (
        <Tarjeta>
          <h2 className="font-display text-2xl font-bold">Primeros pasos</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink-2">
            <li>Pedile a tus flotas clientes que te inviten con el mail de tu cuenta.</li>
            <li>Aceptá las invitaciones en <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/clientes`}>Flotas clientes</Link>.</li>
            <li>Sumá a tus operarios desde <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/equipo`}>Equipo</Link>.</li>
          </ol>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
