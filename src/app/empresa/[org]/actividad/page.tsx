import { Ban, ClipboardCheck, FileText, Receipt, ScrollText, Truck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Vacio } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Aviso, Tarjeta } from '@/components/ui';
import { abrirSeccion, NOMBRE_ROL, type Rol } from '@/lib/empresa';
import { diaDe, fechaLarga, hora, hoyISO } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';
import { describir, navegador, type Evento } from './describir';

export const metadata: Metadata = { title: 'Actividad' };

const CATEGORIAS = [
  { clave: 'todo', texto: 'Todo' },
  { clave: 'equipo', texto: 'Equipo' },
  { clave: 'flota', texto: 'Flota' },
  { clave: 'gastos', texto: 'Gastos' },
  { clave: 'documentos', texto: 'Documentos' },
  { clave: 'taller', texto: 'Taller' },
  { clave: 'seguridad', texto: 'Seguridad' },
];
const ICONO: Record<string, React.ReactNode> = {
  equipo: <Users className="size-4" />, flota: <Truck className="size-4" />, gastos: <Receipt className="size-4" />,
  documentos: <FileText className="size-4" />, taller: <ClipboardCheck className="size-4" />, seguridad: <Ban className="size-4" />,
};
const POR_PAGINA = 50;

// Registro de actividad de la empresa: quién hizo qué, con qué rol, cuándo y desde dónde. Sólo administradores.
export default async function Actividad({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ tipo?: string; antes?: string }> }) {
  const { org } = await params;
  const { tipo: pedido, antes } = await searchParams;
  const { organizacion } = await abrirSeccion(org, 'actividad');
  const tipo = CATEGORIAS.some((c) => c.clave === pedido) ? pedido! : 'todo';
  const supabase = await crearClienteServidor();
  let consulta = supabase.from('auditoria').select('id, user_id, quien, rol, accion, categoria, recurso_id, detalle, ip, agente, creado_en')
    .eq('organizacion_id', org).order('id', { ascending: false }).limit(POR_PAGINA + 1);
  if (tipo !== 'todo') consulta = consulta.eq('categoria', tipo);
  if (antes && /^\d{1,18}$/.test(antes)) consulta = consulta.lt('id', Number(antes));
  const { data, error } = await consulta;
  avisarError('actividad', error);
  const eventos = (data ?? []).slice(0, POR_PAGINA) as Evento[];
  const hayMas = (data?.length ?? 0) > POR_PAGINA;

  // Agrupados por día, en hora argentina.
  const hoy = hoyISO();
  const ayer = diaDe(new Date(Date.now() - 864e5));
  const dias: { dia: string; titulo: string; eventos: Evento[] }[] = [];
  for (const e of eventos) {
    const dia = diaDe(e.creado_en);
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, titulo: dia === hoy ? 'Hoy' : dia === ayer ? 'Ayer' : fechaLarga(new Date(e.creado_en)), eventos: [] });
    dias.at(-1)!.eventos.push(e);
  }
  const enlace = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ tipo: tipo === 'todo' ? undefined : tipo, ...cambios }).filter((x): x is [string, string] => Boolean(x[1])));
    return `/empresa/${org}/actividad${q.size ? `?${q}` : ''}`;
  };

  return (
    <Pantalla className="flex flex-col gap-5">
      <Encabezado titulo="Actividad" bajada={`Quién hizo qué en ${organizacion.nombre}: cambios del equipo, borrados, cierres y accesos sin permiso.`} />
      <nav aria-label="Tipo de actividad" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {CATEGORIAS.map((c) => (
          <Link key={c.clave} href={enlace({ tipo: c.clave === 'todo' ? undefined : c.clave, antes: undefined })} scroll={false} aria-current={tipo === c.clave ? 'page' : undefined}
            className={`tap shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${tipo === c.clave ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-ink-3'}`}>
            {c.texto}
          </Link>
        ))}
      </nav>

      {error ? (
        <Aviso tipo="error">
          {error.code === 'PGRST205' ? 'Falta actualizar la base: ejecutá la migración 0004 en el SQL Editor de Supabase.' : 'No pudimos cargar la actividad. Probá de nuevo en unos segundos.'}
        </Aviso>
      ) : !eventos.length ? (
        <Vacio titulo="Sin actividad para mostrar">
          <span className="flex items-start gap-2"><ScrollText className="mt-0.5 size-5 shrink-0" />Acá van a aparecer los cambios de roles, invitaciones, borrados, órdenes cerradas y los intentos de entrar sin permiso.</span>
        </Vacio>
      ) : (
        dias.map((d) => (
          <Tarjeta key={d.dia}>
            <h2 className="eyebrow first-letter:uppercase">{d.titulo}</h2>
            <ol className="flex flex-col">
              {d.eventos.map((e) => {
                const desde = [e.ip && e.ip !== 'desconocida' ? `IP ${e.ip}` : null, navegador(e.agente)].filter(Boolean).join(' · ');
                return (
                  <li key={e.id} className="flex gap-3 border-b border-line py-3 last:border-0">
                    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${e.categoria === 'seguridad' ? 'bg-crit-soft text-crit' : 'bg-surface-2 text-ink-2'}`}>
                      {ICONO[e.categoria] ?? <ScrollText className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug">
                        <b>{e.quien ?? 'Alguien sin cuenta en la empresa'}</b>
                        {e.rol && <span className="text-ink-3"> ({(NOMBRE_ROL[e.rol as Rol] ?? e.rol).toLowerCase()})</span>}
                        <span className="text-ink-2"> · </span>
                        {describir(e)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">{hora(e.creado_en)}{desde ? ` · ${desde}` : ''}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Tarjeta>
        ))
      )}
      {hayMas && (
        <Link href={enlace({ antes: String(eventos.at(-1)!.id) })} className="tap self-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-ink-3">
          Ver anteriores
        </Link>
      )}
    </Pantalla>
  );
}
