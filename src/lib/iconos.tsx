import { ImageResponse } from 'next/og';

export type AppIcono = 'flota' | 'chofer' | 'taller';
// "comun": cuadrado redondeado. "mascara": Android lo recorta en círculo, el dibujo se achica para quedar en la zona segura.
// "apple": iOS redondea las esquinas por su cuenta, va a sangre.
export type Variante = 'comun' | 'mascara' | 'apple';

// Las tres apps comparten forma y la ruta punteada; cambian el color y el dibujo.
const APPS: Record<AppIcono, { fondo: string; tinta: string; ruta: string }> = {
  flota: { fondo: '#1d4f91', tinta: '#ffffff', ruta: '#f2b705' },
  chofer: { fondo: '#f2b705', tinta: '#14181f', ruta: '#14181f' },
  taller: { fondo: '#0e7490', tinta: '#ffffff', ruta: '#f2b705' },
};

// Camión y llave: trazos de Lucide (licencia ISC) en su grilla de 24, ubicados sobre la ruta.
const DIBUJOS: Record<AppIcono, (tinta: string) => string> = {
  flota: (tinta) => `<path d="M9 8h14v4H13.5v3H21v4h-7.5v5H9z" fill="${tinta}"/>`,
  chofer: (tinta) =>
    `<g transform="translate(16 15) scale(0.8) translate(-12 -12)" fill="none" stroke="${tinta}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">` +
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/>' +
    '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
    '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></g>',
  taller: (tinta) =>
    `<g transform="translate(16 15) scale(0.74) translate(-12 -12)" fill="none" stroke="${tinta}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></g>',
};

export function svgIcono(app: AppIcono, variante: Variante) {
  const { fondo, tinta, ruta } = APPS[app];
  const contenido = DIBUJOS[app](tinta) + `<path d="M5 27h4M12 27h4M19 27h4M26 27h2" stroke="${ruta}" stroke-width="2"/>`;
  const escala = { comun: 1, mascara: 0.74, apple: 0.86 }[variante];
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" ${variante === 'comun' ? 'rx="7" ' : ''}fill="${fondo}"/>` +
    (escala === 1 ? contenido : `<g transform="translate(16 16) scale(${escala}) translate(-16 -16)">${contenido}</g>`) +
    '</svg>'
  );
}

export function imagenIcono(app: AppIcono, variante: Variante, tamano: number) {
  const fuente = `data:image/svg+xml;base64,${Buffer.from(svgIcono(app, variante)).toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <img src={fuente} width={tamano} height={tamano} alt="" />
      </div>
    ),
    { width: tamano, height: tamano },
  );
}

// Archivos que piden los manifiestos de cada app: /icono/chofer-192.png, /icono/chofer-mascara-512.png, etc.
export const ARCHIVOS_ICONO = (['flota', 'chofer', 'taller'] as const).flatMap((app) => [`${app}-192.png`, `${app}-512.png`, `${app}-mascara-512.png`]);

export function leerArchivoIcono(archivo: string) {
  const m = /^(flota|chofer|taller)-(?:(mascara)-)?(192|512)\.png$/.exec(archivo);
  if (!m) return null;
  return { app: m[1] as AppIcono, variante: (m[2] ? 'mascara' : 'comun') as Variante, tamano: Number(m[3]) };
}
