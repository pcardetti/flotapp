// El servidor (Vercel) corre en UTC: las fechas visibles y "hoy" se calculan en hora argentina.
const ZONA = 'America/Argentina/Buenos_Aires';

export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

export const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });

export const fechaCorta = (d: string | Date) => new Date(d).toLocaleDateString('es-AR', { timeZone: ZONA });

export const hora = (d: string | Date) => new Date(d).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// "hoy 08:15", "ayer 19:40" o "12/10 08:15".
export function cuando(d: string | Date) {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(d));
  const hoy = hoyISO();
  const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(Date.now() - 864e5));
  if (fecha === hoy) return `hoy ${hora(d)}`;
  if (fecha === ayer) return `ayer ${hora(d)}`;
  return `${new Date(d).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' })} ${hora(d)}`;
}

// "25 min", "3 h 25 min" o "1 d 2 h" entre dos momentos (o hasta ahora).
export function duracion(desde: string | Date, hasta: string | Date = new Date()) {
  const min = Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return h % 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${Math.floor(h / 24)} d`;
}

// Día (AAAA-MM-DD) de un momento, en hora argentina.
export const diaDe = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(d));

// Para fechas sin hora: "hoy", "ayer", "21/10" o, si es de otro año, "21/10/2025".
export function diaCorto(fechaISO: string) {
  const hoy = hoyISO();
  if (fechaISO === hoy) return 'hoy';
  if (fechaISO === new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(Date.now() - 864e5))) return 'ayer';
  const [a, m, d] = fechaISO.split('-');
  return a === hoy.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

// Días hasta una fecha (negativo si ya pasó).
export const diasHasta = (fechaISO: string) => Math.round((Date.parse(fechaISO) - Date.parse(hoyISO())) / 864e5);
