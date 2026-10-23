import { ClipboardList, QrCode, Route, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca, Patente } from '@/components/ui';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Unidad' };

type Ficha = { unidad: { id: string; organizacion_id: string; dominio: string; marca: string; modelo: string }; empresa: string; mi_rol: string };

// Destino del QR pegado en cada unidad: cada rol va directo a lo suyo. Escaneado desde la app del taller
// (?app=taller), quien también es administrador va a la ficha del taller sin pasar por el menú.
export default async function QrUnidad({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ app?: string }> }) {
  const { codigo } = await params;
  const { app } = await searchParams;
  if (!(await usuarioActual())) redirect(`/ingresar?siguiente=/u/${encodeURIComponent(codigo)}`);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('ficha_qr', { p_token: codigo });
  avisarError('qr', error);
  const ficha = data as Ficha | null;

  if (ficha?.mi_rol === 'chofer') redirect(`/chofer/salida/${codigo}`);
  if (ficha?.mi_rol === 'mecanico' || (ficha && app === 'taller' && ['admin', 'jefe_taller'].includes(ficha.mi_rol))) redirect(`/taller/unidad/${ficha.unidad.id}`);
  if (ficha?.mi_rol === 'lectura') redirect(`/empresa/${ficha.unidad.organizacion_id}/flota/unidades/${ficha.unidad.id}`);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
      <Marca chica />
      {!ficha ? (
        <div className="aparecer flex flex-col items-center gap-4 pt-8 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-surface-2 text-ink-2"><QrCode className="size-10" /></div>
          <h1 className="font-display text-3xl font-bold">Este QR no es de tu flota</h1>
          <p className="text-ink-2">El código no existe o la unidad pertenece a otra empresa.</p>
          <Link href="/empresas" className="tap flex h-14 w-full items-center justify-center rounded-2xl bg-ink text-lg font-bold text-bg">Ir a mi inicio</Link>
        </div>
      ) : (
        <div className="aparecer flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2">
            <Patente dominio={ficha.unidad.dominio} />
            <h1 className="font-display text-3xl font-bold leading-tight">{ficha.unidad.marca} {ficha.unidad.modelo}</h1>
            <p className="text-ink-3">{ficha.empresa}</p>
          </div>
          <p className="font-semibold text-ink-2">¿Qué querés hacer?</p>
          {[
            { href: `/chofer/salida/${codigo}`, icono: <Route className="size-6" />, titulo: 'Salir de viaje', texto: 'Chequeo previo y salida' },
            { href: `/taller/unidad/${ficha.unidad.id}`, icono: <Wrench className="size-6" />, titulo: 'Registrar un trabajo', texto: 'Fallas, reparaciones y mantenimiento' },
            { href: `/empresa/${ficha.unidad.organizacion_id}/flota/unidades/${ficha.unidad.id}`, icono: <ClipboardList className="size-6" />, titulo: 'Ver la ficha', texto: 'Datos, kilometraje e historial' },
          ].map((o) => (
            <Link key={o.href} href={o.href} transitionTypes={['nav-forward']} className="tap flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-ink-3">
              <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-ink">{o.icono}</span>
              <span className="flex flex-col"><b className="text-lg">{o.titulo}</b><span className="text-sm text-ink-3">{o.texto}</span></span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
