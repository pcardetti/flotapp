import { Ban, Container, QrCode, Route, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EncabezadoMovil } from '@/components/movil';
import { Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { tieneMotor } from '@/lib/flota';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { Chequeo, type ItemChequeo } from './chequeo';

export const metadata: Metadata = { title: 'Chequeo de salida' };

type Ficha = {
  unidad: { id: string; organizacion_id: string; dominio: string; tipo: string; marca: string; modelo: string; km: number | null; estado: string };
  viaje_en_curso: { id: string; mio: boolean; chofer: string | null } | null;
  items: ItemChequeo[];
};

function Aviso({ icono, titulo, texto, otra }: { icono: React.ReactNode; titulo: string; texto: string; otra?: { href: string; texto: string } }) {
  return (
    <div className="aparecer flex flex-col items-center gap-4 px-6 pt-10 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-surface-2 text-ink-2">{icono}</div>
      <h2 className="font-display text-3xl font-bold">{titulo}</h2>
      <p className="max-w-sm text-ink-2">{texto}</p>
      <Link href="/chofer" className="tap mt-2 flex h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-ink text-lg font-bold text-bg">Volver al inicio</Link>
      {otra && <Link href={otra.href} className="tap flex h-12 w-full max-w-sm items-center justify-center rounded-2xl border border-line bg-surface font-semibold">{otra.texto}</Link>}
    </div>
  );
}

export default async function Salida({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('ficha_qr', { p_token: codigo });
  avisarError('salida/ficha', error);
  const ficha = data as Ficha | null;

  if (!ficha) {
    return (
      <>
        <EncabezadoMovil titulo="Unidad no encontrada" atras="/chofer" />
        <Aviso icono={<QrCode className="size-10" />} titulo="Este QR no es de tu flota" texto="Revisá que sea la unidad correcta o pedile al encargado que te sume a la empresa." />
      </>
    );
  }
  const { unidad, viaje_en_curso: viaje } = ficha;
  let bloqueo: React.ReactNode = null;
  // Escaneó la unidad con la que ya está viajando: se le explica en vez de mandarlo al inicio sin decir nada.
  if (viaje?.mio) {
    bloqueo = (
      <Aviso icono={<Route className="size-10" />} titulo="Ya estás en viaje con esta unidad" texto="Para hacer un chequeo nuevo, primero terminá el viaje en curso."
        otra={{ href: '/chofer/viaje/terminar', texto: 'Terminar viaje' }} />
    );
  } else if (viaje) bloqueo = <Aviso icono={<Route className="size-10" />} titulo="La unidad ya está en viaje" texto={`${viaje.chofer ?? 'Otro chofer'} la tiene en un viaje en curso. Tiene que terminarlo antes de que puedas salir.`} />;
  else if (unidad.estado === 'baja') bloqueo = <Aviso icono={<Ban className="size-10" />} titulo="La unidad está dada de baja" texto="No se usa más en la flota. Consultá con el encargado." />;
  else if (!tieneMotor(unidad.tipo)) {
    bloqueo = (
      <Aviso icono={<Container className="size-10" />} titulo="Es un remolque" texto="Para salir de viaje escaneá el QR del tractor o del camión."
        otra={{ href: `/chofer/falla?u=${unidad.id}`, texto: 'Avisar una falla del remolque' }} />
    );
  } else if (unidad.estado === 'taller') bloqueo = <Aviso icono={<Wrench className="size-10" />} titulo="La unidad está en el taller" texto="Tiene una reparación pendiente. Cuando el taller la libere vas a poder salir." />;

  return (
    <>
      <EncabezadoMovil titulo="Chequeo de salida" bajada={`${unidad.marca} ${unidad.modelo}`} atras="/chofer" accion={<Patente dominio={unidad.dominio} />} />
      <Pantalla>
        {bloqueo ?? <Chequeo codigo={codigo} org={unidad.organizacion_id} items={ficha.items} kmUltimo={unidad.km} dominio={unidad.dominio} />}
      </Pantalla>
    </>
  );
}
