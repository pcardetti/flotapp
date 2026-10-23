import { UserMinus } from 'lucide-react';
import type { Metadata } from 'next';
import { FormConfirmado } from '@/components/confirmar';
import { Encabezado } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Pildora, Tarjeta } from '@/components/ui';
import { NOMBRE_ROL, abrirSeccion, type Rol } from '@/lib/empresa';
import { cuando, fechaCorta } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { urlBase } from '@/lib/url';
import { cambiarRol, quitarMiembro, revocarInvitacion } from './acciones';
import { Compartir, FormInvitar } from './formularios';
import { textoWhatsApp } from './textos';

export const metadata: Metadata = { title: 'Equipo' };

const ROLES_FLOTA: Rol[] = ['admin', 'jefe_taller', 'mecanico', 'chofer', 'lectura'];
const ROLES_PROVEEDOR: Rol[] = ['admin', 'operario'];

export default async function Equipo({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { usuario, organizacion } = await abrirSeccion(org, 'equipo');
  const supabase = await crearClienteServidor();
  const esFlota = organizacion.tipo === 'flota';
  const [{ data: miembros, error }, { data: invitaciones }, { data: choferes }, { data: ingresos }] = await Promise.all([
    supabase.from('miembros').select('user_id, rol, nombre, creado_en, chofer_id, chofer:choferes(nombre)').eq('organizacion_id', org).order('creado_en'),
    supabase.from('invitaciones').select('id, token, rol, nombre, vence, creada_en').eq('organizacion_id', org).is('usada_en', null).eq('revocada', false).gt('vence', new Date().toISOString()).order('creada_en', { ascending: false }),
    esFlota ? supabase.from('choferes').select('id, nombre').eq('organizacion_id', org).order('nombre') : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    supabase.rpc('ultimos_ingresos', { p_org: org }),
  ]);
  avisarError('equipo', error);
  const ultimoIngreso = new Map(((ingresos ?? []) as { user_id: string; ultimo_ingreso: string | null }[]).map((i) => [i.user_id, i.ultimo_ingreso]));
  // Choferes que todavía no tienen cuenta: se pueden vincular al invitarlos.
  const conCuenta = new Set((miembros ?? []).map((m) => m.chofer_id).filter(Boolean));
  const choferesSinCuenta = (choferes ?? []).filter((c) => !conCuenta.has(c.id));
  const base = await urlBase();
  const roles = esFlota ? ROLES_FLOTA : ROLES_PROVEEDOR;

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Equipo" bajada={`${miembros?.length ?? 0} personas con acceso a ${organizacion.nombre}`} />

      <Tarjeta>
        <h2 className="font-display text-xl font-bold">Invitar a alguien</h2>
        <FormInvitar org={org} empresa={organizacion.nombre} esFlota={esFlota} choferesSinCuenta={choferesSinCuenta} />
      </Tarjeta>

      {invitaciones && invitaciones.length > 0 && (
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Invitaciones pendientes <span className="text-ink-3">· {invitaciones.length}</span></h2>
          <ul className="flex flex-col">
            {invitaciones.map((i) => {
              const enlace = `${base}/invitacion/${i.token}`;
              return (
                <li key={i.id} className="flex flex-col gap-3 border-b border-line py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{i.nombre ?? 'Sin nombre'}</b>
                    <Pildora tipo="info">{NOMBRE_ROL[i.rol as Rol]}</Pildora>
                    <span className="text-sm text-ink-3">vence el {fechaCorta(i.vence)}</span>
                    <FormConfirmado accion={revocarInvitacion.bind(null, org, i.id)} pregunta={`¿Cancelar la invitación de ${i.nombre ?? 'esta persona'}? El enlace deja de funcionar.`} className="ml-auto">
                      <button className="text-sm font-semibold text-ink-3 hover:text-crit">Cancelar invitación</button>
                    </FormConfirmado>
                  </div>
                  <Compartir enlace={enlace} texto={textoWhatsApp(i.nombre ?? '', organizacion.nombre, i.rol as Rol, enlace)} />
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta>
        <h2 className="font-display text-xl font-bold">Personas con acceso</h2>
        <ul className="flex flex-col">
          {(miembros ?? []).map((m) => {
            const yo = m.user_id === usuario.id;
            const chofer = (Array.isArray(m.chofer) ? m.chofer[0] : m.chofer) as { nombre: string } | null;
            const nombre = yo ? `${m.nombre ?? usuario.email} (vos)` : m.nombre ?? chofer?.nombre ?? 'Integrante';
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg font-bold">{nombre.trim()[0]?.toUpperCase()}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate">{nombre}</b>
                  <span className="text-sm text-ink-3">
                    Desde {fechaCorta(m.creado_en)}{chofer && !yo ? ` · chofer ${chofer.nombre}` : ''}
                    {ultimoIngreso.has(m.user_id) && ` · ${ultimoIngreso.get(m.user_id) ? `último ingreso ${cuando(ultimoIngreso.get(m.user_id)!)}` : 'nunca ingresó'}`}
                  </span>
                </span>
                {yo ? (
                  <Pildora tipo="info">{NOMBRE_ROL[m.rol as Rol]}</Pildora>
                ) : (
                  <span className="flex items-center gap-2">
                    <form action={cambiarRol.bind(null, org, m.user_id)} className="flex items-center gap-2">
                      <select name="rol" defaultValue={m.rol} aria-label={`Rol de ${nombre}`} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
                        {roles.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
                      </select>
                      <button className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold hover:border-ink-3">Guardar</button>
                    </form>
                    <FormConfirmado accion={quitarMiembro.bind(null, org, m.user_id)} pregunta={`¿Quitar a ${nombre} de ${organizacion.nombre}? Pierde el acceso enseguida.`}>
                      <button aria-label={`Quitar a ${nombre}`} className="tap grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-crit-soft hover:text-crit"><UserMinus className="size-4" /></button>
                    </FormConfirmado>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </Pantalla>
  );
}
