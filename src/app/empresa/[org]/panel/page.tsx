import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { fechaLarga, hoyISO } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Panel' };

type Dato = { titulo: string; valor: number | null; detalle: string; ruta: string; alerta?: boolean };

export default async function Panel({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { organizacion, rol } = await abrirSeccion(org, 'panel');
  const supabase = await crearClienteServidor();
  // Si una consulta falla se muestra "—" en lugar de un 0 engañoso.
  const contar = async (consulta: PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>) => {
    const { count, error } = await consulta;
    avisarError('panel', error);
    return error ? null : (count ?? 0);
  };
  const hoy = hoyISO();

  let datos: Dato[];
  if (organizacion.tipo === 'flota') {
    const [unidades, abiertas, vencidos, montados] = await Promise.all([
      contar(supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('organizacion_id', org).neq('estado', 'baja')),
      contar(supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('organizacion_id', org).neq('estado', 'cerrada')),
      contar(supabase.from('documentos').select('*', { count: 'exact', head: true }).eq('organizacion_id', org).lt('vence', hoy)),
      contar(supabase.from('neumaticos').select('*', { count: 'exact', head: true }).eq('organizacion_id', org).eq('estado', 'montado')),
    ]);
    datos = [
      { titulo: 'Unidades activas', valor: unidades, detalle: 'Tractores, chasis y remolques', ruta: 'flota' },
      { titulo: 'Órdenes abiertas', valor: abiertas, detalle: 'En taller propio o derivadas', ruta: 'ordenes' },
      { titulo: 'Documentos vencidos', valor: vencidos, detalle: 'RTO, seguros, licencias', ruta: 'vencimientos', alerta: (vencidos ?? 0) > 0 },
      { titulo: 'Neumáticos montados', valor: montados, detalle: 'Con código e historial', ruta: 'neumaticos' },
    ];
  } else {
    const [clientes, pendientes, trabajo] = await Promise.all([
      contar(supabase.from('vinculos_proveedor').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).eq('estado', 'activo')),
      contar(supabase.from('vinculos_proveedor').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).eq('estado', 'pendiente')),
      organizacion.tipo === 'taller'
        ? contar(supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('proveedor_id', org).neq('estado', 'cerrada'))
        : contar(supabase.from('neumaticos').select('*', { count: 'exact', head: true }).eq('proveedor_actual_id', org)),
    ]);
    datos = [
      organizacion.tipo === 'taller'
        ? { titulo: 'Trabajos en curso', valor: trabajo, detalle: 'Órdenes derivadas por tus clientes', ruta: 'trabajos' }
        : { titulo: 'Neumáticos recibidos', valor: trabajo, detalle: 'Esperando recapado', ruta: 'recapados' },
      { titulo: 'Flotas clientes', valor: clientes, detalle: 'Con vínculo activo', ruta: 'clientes' },
      { titulo: 'Invitaciones', valor: pendientes, detalle: 'Flotas que esperan tu respuesta', ruta: 'clientes', alerta: (pendientes ?? 0) > 0 },
    ];
  }

  return (
    <>
      <Encabezado titulo={organizacion.nombre} bajada={fechaLarga()} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {datos.map((d) => (
          <Link key={d.titulo} href={`/empresa/${org}/${d.ruta}`} className={`flex flex-col gap-1 rounded-xl border bg-surface px-4 py-3.5 hover:border-ink-3 ${d.alerta ? 'border-crit' : 'border-line'}`}>
            <span className="eyebrow">{d.titulo}</span>
            <span className="font-display text-4xl font-bold leading-none">{d.valor ?? '—'}</span>
            <span className="text-sm text-ink-2">{d.detalle}</span>
          </Link>
        ))}
      </div>
      {rol === 'admin' && <Tarjeta>
        <h2 className="font-display text-2xl font-bold">Primeros pasos</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink-2">
          {organizacion.tipo === 'flota' ? (
            <>
              <li>Cargá tus unidades y choferes en <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/flota`}>Flota y choferes</Link>.</li>
              <li>Invitá a tu equipo desde <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/equipo`}>Equipo</Link>.</li>
              <li>Vinculá tus talleres y recapadoras en <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/proveedores`}>Talleres y recapadoras</Link>.</li>
            </>
          ) : (
            <>
              <li>Pedile a tus flotas clientes que te inviten con el mail de tu cuenta.</li>
              <li>Aceptá las invitaciones en <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/clientes`}>Flotas clientes</Link>.</li>
              <li>Sumá a tus operarios desde <Link className="font-semibold text-accent hover:underline" href={`/empresa/${org}/equipo`}>Equipo</Link>.</li>
            </>
          )}
        </ol>
      </Tarjeta>}
    </>
  );
}
