// El servidor (Vercel) corre en UTC: las fechas visibles y "hoy" se calculan en hora argentina.
const ZONA = 'America/Argentina/Buenos_Aires';

export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

export const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });

export const fechaCorta = (d: string | Date) => new Date(d).toLocaleDateString('es-AR', { timeZone: ZONA });
