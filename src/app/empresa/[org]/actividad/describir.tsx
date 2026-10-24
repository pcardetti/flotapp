import { NOMBRE_ROL, type Rol } from '@/lib/empresa';
import { NOMBRE_CATEGORIA, pesos } from '@/lib/formato';
import { SECCIONES } from '@/lib/navegacion';
import { esPermiso, PERMISOS } from '@/lib/permisos';
import { nombreSistema } from '@/lib/taller';

export type Evento = {
  id: number;
  user_id: string | null;
  quien: string | null;
  rol: string | null;
  accion: string;
  categoria: string;
  recurso_id: string | null;
  detalle: Record<string, string | number | null>;
  ip: string | null;
  agente: string | null;
  creado_en: string;
};

const rol = (r: unknown) => (NOMBRE_ROL[r as Rol] ?? String(r ?? '')).toLowerCase();
const fecha = (iso: unknown) => (typeof iso === 'string' ? iso.slice(0, 10).split('-').reverse().join('/') : '');
// Lo que se intentó hacer sin permiso. Los avisos anteriores a la tabla de permisos guardaban la sección.
const intento = (que: unknown) =>
  esPermiso(que) ? PERMISOS[que].que : `entrar a ${SECCIONES.find((s) => s.ruta === que)?.titulo ?? String(que ?? '')}`;

// Una oración por evento, con los nombres que había en ese momento (aunque después se borren).
export function describir(e: Evento): React.ReactNode {
  const d = e.detalle ?? {};
  const b = (texto: unknown) => <b>{String(texto ?? '—')}</b>;
  switch (e.accion) {
    case 'miembro.alta':
      return e.user_id === e.recurso_id ? <>Se sumó como {rol(d.rol)}</> : <>Sumó a {b(d.nombre)} como {rol(d.rol)}</>;
    case 'miembro.rol':
      return <>Cambió el rol de {b(d.nombre)}: {rol(d.de)} → {b(rol(d.a))}</>;
    case 'miembro.baja':
      return <>Quitó a {b(d.nombre)} ({rol(d.rol)}) de la empresa</>;
    case 'invitacion.creada':
      return <>Invitó a {b(d.nombre ?? 'alguien')} como {rol(d.rol)}</>;
    case 'invitacion.cancelada':
      return <>Canceló la invitación de {b(d.nombre ?? 'alguien')}</>;
    case 'unidad.borrada':
      return <>Eliminó la unidad {b(d.dominio)} ({String(d.marca ?? '')} {String(d.modelo ?? '')})</>;
    case 'unidad.baja':
      return <>Dio de baja la unidad {b(d.dominio)}</>;
    case 'unidad.reactivada':
      return <>Volvió a poner en servicio la unidad {b(d.dominio)}</>;
    case 'chofer.borrado':
      return <>Eliminó al chofer {b(d.nombre)}</>;
    case 'gasto.borrado':
      return <>Borró un gasto de {(NOMBRE_CATEGORIA[String(d.categoria)] ?? String(d.categoria ?? '')).toLowerCase()} por {b(pesos(Number(d.monto ?? 0)))} del {fecha(d.fecha)}{d.dominio ? <> ({String(d.dominio)})</> : null}</>;
    case 'documento.renovado':
      return <>Renovó {b(d.tipo)} de {String(d.titular ?? '')}: ahora vence el {fecha(d.a)}</>;
    case 'documento.borrado':
      return <>Eliminó {b(d.tipo)} de {String(d.titular ?? '')}</>;
    case 'tipo_documento.borrado':
      return <>Eliminó el tipo de documento {b(d.nombre)}</>;
    case 'orden.cerrada':
      return <>Cerró la orden {b(`#${d.numero}`)} de {String(d.dominio ?? '')}: {String(d.descripcion ?? '')}{Number(d.costo) ? <> · {pesos(Number(d.costo))}</> : null}</>;
    case 'falla.descartada':
      return <>Descartó la falla de {b(nombreSistema(String(d.sistema ?? '')))} de {String(d.dominio ?? '')}{d.gravedad === 'critica' ? ' (era crítica)' : ''}</>;
    case 'permiso.denegado':
      return <>Intentó {b(intento(d.que))} sin permiso</>;
    default:
      return e.accion;
  }
}

// "Chrome en Android" a partir del navegador que informa el celular o la PC.
export function navegador(agente: string | null) {
  if (!agente) return null;
  const app = /Edg\//.test(agente) ? 'Edge' : /SamsungBrowser/.test(agente) ? 'Samsung Internet' : /Firefox\//.test(agente) ? 'Firefox'
    : /Chrome\//.test(agente) ? 'Chrome' : /Safari\//.test(agente) ? 'Safari' : null;
  const sistema = /Android/.test(agente) ? 'Android' : /iPhone|iPad/.test(agente) ? 'iPhone' : /Windows/.test(agente) ? 'Windows'
    : /Mac OS X/.test(agente) ? 'Mac' : /Linux/.test(agente) ? 'Linux' : null;
  return [app, sistema].filter(Boolean).join(' en ') || null;
}
