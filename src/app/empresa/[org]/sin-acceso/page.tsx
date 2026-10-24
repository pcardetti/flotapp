import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { BotonLink, Tarjeta } from '@/components/ui';
import { NOMBRE_ROL, empresaActual } from '@/lib/empresa';
import { seccionesPara } from '@/lib/navegacion';
import { esPermiso, GRUPOS, PERMISOS, ROLES_DE, type Rol } from '@/lib/permisos';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Sin acceso' };

const lista = (partes: string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(partes);

// Adonde llega quien intenta entrar a una sección o hacer algo que su rol no permite (ver abrirSeccion):
// qué no puede hacer, qué roles sí pueden y a quién pedírselo.
export default async function SinAcceso({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ que?: string }> }) {
  const { org } = await params;
  const { que } = await searchParams;
  const empresa = await empresaActual(org);
  const { organizacion, rol, usuario } = empresa;
  const regla = esPermiso(que) ? PERMISOS[que] : null;
  const supabase = await crearClienteServidor();
  const { data: admins, error } = await supabase.from('miembros').select('user_id, nombre').eq('organizacion_id', org).eq('rol', 'admin');
  avisarError('sin-acceso', error);
  const nombres = (admins ?? []).flatMap((a) => (a.nombre && a.user_id !== usuario.id ? [String(a.nombre)] : []));
  const pueden = regla ? (GRUPOS[regla.grupo] as readonly Rol[]).filter((r) => ROLES_DE[organizacion.tipo].includes(r)).map((r) => NOMBRE_ROL[r]) : [];
  const inicio = seccionesPara(empresa)[0];

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo={regla ? `No podés ${regla.que}` : 'No tenés acceso'} bajada={`Tu rol en ${organizacion.nombre} es ${NOMBRE_ROL[rol]}.`} />
      <Tarjeta className="flex flex-col items-start gap-3">
        <Lock className="size-6 text-ink-3" aria-hidden />
        {pueden.length > 0 && <p>Lo pueden hacer: <b>{lista(pueden)}</b>.</p>}
        <p className="text-ink-2">
          {nombres.length
            ? <>Si lo necesitás, pedíselo a <b>{lista(nombres)}</b>, que {nombres.length > 1 ? 'administran' : 'administra'} la empresa.</>
            : 'Si lo necesitás, pedíselo a quien administra la empresa.'}
        </p>
        {inicio && <BotonLink href={`/empresa/${org}/${inicio.ruta}`}>Volver a {inicio.titulo}</BotonLink>}
      </Tarjeta>
    </Pantalla>
  );
}
