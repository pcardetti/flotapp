// Números para leer de un vistazo, en formato argentino. El espacio es duro ( ): "$ 431.100" no se corta en dos líneas.

export const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

export function pesosCorto(n: number) {
  if (Math.abs(n) >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: n >= 1e7 ? 0 : 1 })} M`;
  if (Math.abs(n) >= 1e3) return `$ ${Math.round(n / 1e3).toLocaleString('es-AR')} mil`;
  return `$ ${Math.round(n)}`;
}

export const numero = (n: number, decimales = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales, minimumFractionDigits: decimales });

export const km = (n: number) => `${Math.round(n).toLocaleString('es-AR')} km`;

// "1 orden abierta", "3 órdenes abiertas".
export const cuantas = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Categorías de costo: el orden y el color son fijos para que cada una se reconozca en todos los gráficos.
export const SERIES_COSTO = [
  { clave: 'combustible', nombre: 'Combustible', color: 'var(--s1)', categorias: ['combustible'] },
  { clave: 'mantenimiento', nombre: 'Mantenimiento', color: 'var(--s2)', categorias: ['mantenimiento'] },
  { clave: 'neumaticos', nombre: 'Neumáticos', color: 'var(--s3)', categorias: ['neumaticos'] },
  { clave: 'peajes', nombre: 'Peajes y viáticos', color: 'var(--s4)', categorias: ['peaje', 'viatico'] },
  { clave: 'seguros', nombre: 'Seguros y patentes', color: 'var(--s5)', categorias: ['seguro', 'patente'] },
  { clave: 'otros', nombre: 'Otros', color: 'var(--s6)', categorias: ['multa', 'lavado', 'otro'] },
] as const;

export const NOMBRE_CATEGORIA: Record<string, string> = {
  combustible: 'Combustible', mantenimiento: 'Mantenimiento', neumaticos: 'Neumáticos', peaje: 'Peajes', viatico: 'Viáticos',
  seguro: 'Seguros', patente: 'Patentes', multa: 'Multas', lavado: 'Lavado', otro: 'Otros',
};

export const serieDe = (categoria: string) => SERIES_COSTO.find((s) => (s.categorias as readonly string[]).includes(categoria)) ?? SERIES_COSTO[5];
