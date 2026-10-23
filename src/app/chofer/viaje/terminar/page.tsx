import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { cuando, duracion } from '@/lib/fechas';
import { crearClienteServidor } from '@/lib/supabase/server';
import { FormTerminar } from '../../formularios';

export const metadata: Metadata = { title: 'Terminar viaje' };

export default async function TerminarViaje() {
  const { organizacion, usuario } = await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  const { data: viaje } = await supabase.from('viajes').select('id, inicio, km_inicio, unidad:unidades(dominio)')
    .eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'en_curso').maybeSingle();
  if (!viaje) redirect('/chofer');
  const unidad = (Array.isArray(viaje.unidad) ? viaje.unidad[0] : viaje.unidad) as { dominio: string } | null;
  return (
    <>
      <EncabezadoMovil titulo="Terminar viaje" bajada={`Salida ${cuando(viaje.inicio)} · ${duracion(viaje.inicio)}`} atras="/chofer" accion={unidad && <Patente dominio={unidad.dominio} />} />
      <Pantalla>
        <FormTerminar viaje={viaje.id} kmInicio={viaje.km_inicio} />
      </Pantalla>
    </>
  );
}
