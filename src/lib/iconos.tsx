import { ImageResponse } from 'next/og';

export type AppIcono = 'flota' | 'chofer' | 'taller';
// "comun": cuadrado redondeado. "mascara": Android lo recorta en círculo, el dibujo se achica para quedar en la zona segura.
// "apple": iOS redondea las esquinas por su cuenta, va a sangre.
export type Variante = 'comun' | 'mascara' | 'apple';

// Las tres apps comparten la forma; cambian el fondo y el dibujo (marca Tallerflota, dirección "Instrumento").
// Tallerflota: medidor blanco sobre índigo. Chofer: camión índigo claro sobre noche. Taller: llave índigo sobre blanco.
const APPS: Record<AppIcono, { fondo: string; tinta: string }> = {
  flota: { fondo: '#4338ca', tinta: '#ffffff' },
  chofer: { fondo: '#161a2e', tinta: '#8b85ff' },
  taller: { fondo: '#ffffff', tinta: '#4338ca' },
};

// Medidor propio; camión y llave: trazos de Lucide (licencia ISC) en su grilla de 24, centrados en la de 32.
const DIBUJOS: Record<AppIcono, (tinta: string) => string> = {
  flota: (tinta) =>
    `<g fill="none" stroke="${tinta}" stroke-linecap="round"><path d="M7 21.5a9 9 0 0 1 18 0" stroke-width="2.6"/>` +
    `<path d="M16 21.5 21.5 14.5" stroke-width="2.2"/></g><circle cx="16" cy="21.5" r="2" fill="${tinta}"/>`,
  chofer: (tinta) =>
    `<g transform="translate(16 16) scale(0.8) translate(-12 -12)" fill="none" stroke="${tinta}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">` +
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/>' +
    '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
    '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></g>',
  taller: (tinta) =>
    `<g transform="translate(16 16) scale(0.74) translate(-12 -12)" fill="none" stroke="${tinta}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></g>',
};

export function svgIcono(app: AppIcono, variante: Variante) {
  const { fondo, tinta } = APPS[app];
  const contenido = DIBUJOS[app](tinta);
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
