// Destinos de vuelta (`siguiente`) después de ingresar o confirmar el mail: sólo rutas de la propia app.
// Rechaza "//sitio.com", "/\sitio.com" (el navegador lee la barra invertida como "/"), esquemas como
// "https:" o "javascript:" y caracteres de control, que convertirían el enlace en una puerta a otro sitio.
const BASE = 'https://flotapp.invalid';

export function rutaInterna(valor: unknown, porDefecto = '/empresas'): string {
  if (typeof valor !== 'string' || valor.length > 2048) return porDefecto;
  if (!valor.startsWith('/') || valor.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(valor)) return porDefecto;
  try {
    const url = new URL(valor, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : porDefecto;
  } catch {
    return porDefecto;
  }
}
