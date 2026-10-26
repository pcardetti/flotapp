// Períodos que se eligen en el tablero y en la ficha de la unidad. Sin dependencias, para poder probarlos solos.

export const PERIODOS = [
  { clave: 'mes', texto: 'Este mes', corto: 'Mes' },
  { clave: 'anterior', texto: 'Mes anterior', corto: 'Anterior' },
  { clave: '90', texto: 'Últimos 90 días', corto: '90 días' },
  { clave: 'anio', texto: 'Este año', corto: 'Año' },
] as const;

export const periodoValido = (p: string | undefined) => (PERIODOS.some((x) => x.clave === p) ? p! : 'mes');

const dos = (n: number) => String(n).padStart(2, '0');

// Desde y hasta (AAAA-MM-DD) del período, contando desde `hoy` en hora argentina.
export function rango(p: string, hoy: string) {
  const [a, m] = hoy.split('-').map(Number);
  if (p === 'anterior') {
    const fin = new Date(Date.UTC(a, m - 1, 0));
    return { desde: `${fin.getUTCFullYear()}-${dos(fin.getUTCMonth() + 1)}-01`, hasta: fin.toISOString().slice(0, 10) };
  }
  if (p === '90') return { desde: new Date(Date.parse(hoy) - 89 * 864e5).toISOString().slice(0, 10), hasta: hoy };
  if (p === 'anio') return { desde: `${a}-01-01`, hasta: hoy };
  return { desde: `${a}-${dos(m)}-01`, hasta: hoy };
}
