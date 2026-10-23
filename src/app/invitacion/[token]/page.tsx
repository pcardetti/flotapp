import { MailX, Route, ShieldCheck, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Marca } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';
import { BotonAceptar } from './boton';

export const metadata: Metadata = { title: 'Invitación' };

type Invitacion = { empresa: string; tipo: string; rol: string; nombre: string | null; estado: 'vigente' | 'usada' | 'vencida' | 'revocada' };

const ROL: Record<string, { texto: string; app: string; icono: React.ReactNode }> = {
  chofer: { texto: 'chofer', app: 'Vas a usar la app Chofer: escaneás el QR de la unidad, hacés el chequeo y salís.', icono: <Route className="size-7" /> },
  mecanico: { texto: 'mecánico', app: 'Vas a usar la app Taller: ves las fallas con fotos y registrás los trabajos.', icono: <Wrench className="size-7" /> },
  jefe_taller: { texto: 'jefe de taller', app: 'Vas a gestionar la flota y el taller desde Flotapp.', icono: <ShieldCheck className="size-7" /> },
  lectura: { texto: 'consulta', app: 'Vas a poder ver el tablero y los datos de la flota.', icono: <ShieldCheck className="size-7" /> },
  operario: { texto: 'operario', app: 'Vas a trabajar sobre lo que te asignen las flotas clientes.', icono: <Wrench className="size-7" /> },
  admin: { texto: 'administrador', app: 'Vas a administrar la empresa en Flotapp.', icono: <ShieldCheck className="size-7" /> },
};

const MOTIVO: Record<string, string> = {
  usada: 'Esta invitación ya se usó. Si sos vos, ingresá con tu cuenta.',
  vencida: 'Esta invitación venció. Pedile a quien te invitó que te mande una nueva.',
  revocada: 'Esta invitación fue cancelada. Pedile a quien te invitó que te mande una nueva.',
};

export default async function PaginaInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[0-9a-f]{64}$/.test(token) && supabaseConfigurado();
  const supabase = valido ? await crearClienteServidor() : null;
  const [usuario, respuesta] = await Promise.all([usuarioActual(), supabase?.rpc('ver_invitacion', { p_token: token })]);
  avisarError('verInvitacion', respuesta?.error ?? null);
  const inv = (respuesta?.data ?? null) as Invitacion | null;
  const siguiente = encodeURIComponent(`/invitacion/${token}`);
  const r = inv ? ROL[inv.rol] ?? ROL.lectura : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+28px)]">
      <Marca chica />
      {!inv || !r ? (
        <div className="aparecer flex flex-col items-center gap-4 pt-6 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-surface-2 text-ink-2"><MailX className="size-8" /></div>
          <h1 className="font-display text-3xl font-bold">Invitación no encontrada</h1>
          <p className="text-ink-2">Revisá que el enlace esté completo o pedí uno nuevo.</p>
        </div>
      ) : (
        <div className="aparecer flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-ink">{r.icono}</div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              {inv.nombre ? `${inv.nombre.split(' ')[0]}, te` : 'Te'} invitaron a <span className="text-accent">{inv.empresa}</span>
            </h1>
            <p className="text-lg text-ink-2">Como {r.texto}. {r.app}</p>
          </div>
          {inv.estado !== 'vigente' ? (
            <p className="rounded-2xl bg-warn-soft px-4 py-3 font-semibold text-warn">{MOTIVO[inv.estado]}</p>
          ) : usuario ? (
            <>
              <BotonAceptar token={token} />
              <p className="text-center text-sm text-ink-3">Vas a entrar como {usuario.email}.</p>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <Link href={`/registrarse?siguiente=${siguiente}`} className="tap flex h-14 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink shadow-tarjeta">Crear mi cuenta</Link>
              <Link href={`/ingresar?siguiente=${siguiente}`} className="tap flex h-14 items-center justify-center rounded-2xl border border-line bg-surface text-lg font-semibold">Ya tengo cuenta</Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
