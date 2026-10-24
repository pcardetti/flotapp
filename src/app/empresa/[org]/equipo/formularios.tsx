'use client';

import { Check, ClipboardCheck, Copy, MessageCircle, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Aviso, Boton, Campo } from '@/components/ui';
import { ROLES_DE, type Rol } from '@/lib/permisos';
import { crearInvitacion, type EstadoInvitacion } from './acciones';
import { textoWhatsApp } from './textos';

const ROLES: { rol: Rol; titulo: string; detalle: string }[] = [
  { rol: 'chofer', titulo: 'Chofer', detalle: 'Usa la app Chofer: chequeo, viajes, gastos y fallas.' },
  { rol: 'mecanico', titulo: 'Mecánico', detalle: 'Usa la app Taller: resuelve fallas y registra trabajos.' },
  { rol: 'jefe_taller', titulo: 'Jefe de taller', detalle: 'Gestiona la flota y el taller. No administra el equipo.' },
  { rol: 'lectura', titulo: 'Consulta', detalle: 'Ve el tablero y los datos, sin modificar nada.' },
  { rol: 'operario', titulo: 'Operario', detalle: 'Trabaja sobre lo que le asignan las flotas clientes.' },
  { rol: 'admin', titulo: 'Administrador', detalle: 'Todo, incluido invitar y quitar personas.' },
];

// Copiar, WhatsApp y QR: las tres formas de pasar el enlace con un toque.
export function Compartir({ enlace, texto, conQr = false }: { enlace: string; texto: string; conQr?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [svg, setSvg] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (conQr) QRCode.toString(enlace, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg(''));
  }, [enlace, conQr]);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
    } catch {
      campo.current?.select();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {conQr && svg && <div className="size-36 shrink-0 rounded-xl bg-white p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR de la invitación" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input ref={campo} readOnly value={enlace} onFocus={(e) => e.target.select()} className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2" aria-label="Enlace de invitación" />
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-2 rounded-lg bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
            <MessageCircle className="size-4" />Enviar por WhatsApp
          </a>
          <button type="button" onClick={copiar} className="tap inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold">
            {copiado ? <><ClipboardCheck className="size-4 text-ok" />Copiado</> : <><Copy className="size-4" />Copiar enlace</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FormInvitar({ org, empresa, esFlota, choferesSinCuenta }: { org: string; empresa: string; esFlota: boolean; choferesSinCuenta: { id: string; nombre: string }[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoInvitacion, FormData>(crearInvitacion.bind(null, org), {});
  const roles = ROLES.filter((r) => ROLES_DE[esFlota ? 'flota' : 'taller'].includes(r.rol));
  const [rol, setRol] = useState<Rol>(roles[0].rol);
  const [nombre, setNombre] = useState('');
  const [chofer, setChofer] = useState('');
  const [cerrada, setCerrada] = useState<number | null>(null);
  const e = estado.errores ?? {};

  if (estado.enlace && estado.nombre && estado.rol && estado.clave !== cerrada) {
    return (
      <div className="aparecer flex flex-col gap-4">
        <p className="flex items-center gap-2 font-semibold text-ok"><Check className="size-5" />Listo. Mandale el enlace a {estado.nombre}:</p>
        <Compartir enlace={estado.enlace} texto={textoWhatsApp(estado.nombre, empresa, estado.rol, estado.enlace)} conQr />
        <p className="text-sm text-ink-3">El enlace sirve una sola vez y vence en 7 días. Si la persona está al lado tuyo, que escanee el QR con la cámara.</p>
        <div><Boton type="button" variante="secundario" onClick={() => { setCerrada(estado.clave ?? null); setNombre(''); setChofer(''); }}><UserPlus className="size-4" />Invitar a otra persona</Boton></div>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="rol" value={rol} />
      <Campo label="Nombre y apellido" name="nombre" value={nombre} onChange={(x) => setNombre(x.target.value)} placeholder="Darío Ledesma" error={e.nombre} autoComplete="off" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">¿Qué va a hacer?</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <button key={r.rol} type="button" onClick={() => setRol(r.rol)} aria-pressed={rol === r.rol}
              className={`tap flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${rol === r.rol ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-ink-3'}`}>
              <b>{r.titulo}</b><span className="text-sm text-ink-3">{r.detalle}</span>
            </button>
          ))}
        </div>
        {e.rol && <span className="text-xs font-semibold text-crit">{e.rol}</span>}
      </fieldset>
      {rol === 'chofer' && choferesSinCuenta.length > 0 && (
        <div className="aparecer flex flex-col gap-1.5">
          <label htmlFor="chofer" className="text-sm font-semibold text-ink-2">¿Ya lo cargaste como chofer?</label>
          <select id="chofer" name="chofer" value={chofer} onChange={(x) => { setChofer(x.target.value); const c = choferesSinCuenta.find((y) => y.id === x.target.value); if (c && !nombre) setNombre(c.nombre); }}
            className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-accent">
            <option value="">No, crear su ficha con este nombre</option>
            {choferesSinCuenta.map((c) => <option key={c.id} value={c.id}>Sí: {c.nombre}</option>)}
          </select>
        </div>
      )}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div><Boton type="submit" disabled={enviando}><UserPlus className="size-4" />{enviando ? 'Creando…' : 'Crear invitación'}</Boton></div>
    </form>
  );
}
