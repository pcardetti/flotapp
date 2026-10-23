import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { Pildora, Tarjeta } from '@/components/ui';
import { NOMBRE_ROL, abrirSeccion, type Rol } from '@/lib/empresa';
import { fechaCorta } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Equipo' };

export default async function Equipo({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { usuario, organizacion } = await abrirSeccion(org, 'equipo');
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('miembros').select('user_id, rol, creado_en').eq('organizacion_id', org).order('creado_en');
  avisarError('equipo', error);

  return (
    <>
      <Encabezado titulo="Equipo" bajada={`Personas con acceso a ${organizacion.nombre}`} />
      <Tarjeta>
        <ul className="flex flex-col">
          {(data ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
              <span className="flex flex-col">
                <b>{m.user_id === usuario.id ? `${usuario.email} (vos)` : 'Integrante del equipo'}</b>
                <span className="text-sm text-ink-3">Desde {fechaCorta(m.creado_en)}</span>
              </span>
              <Pildora tipo={m.rol === 'admin' ? 'info' : 'neutro'}>{NOMBRE_ROL[m.rol as Rol]}</Pildora>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
          Las invitaciones por mail (jefes de taller, choferes, consulta{organizacion.tipo !== 'flota' ? ', operarios' : ''}) llegan en la próxima etapa.
        </p>
      </Tarjeta>
    </>
  );
}
