import QRCode from 'qrcode';
import { urlBase } from '@/lib/url';

// El QR de cada unidad apunta a /u/<código>: con la cámara del celular abre la app correcta según el rol.
export async function enlaceUnidad(codigo: string) {
  return `${await urlBase()}/u/${codigo}`;
}

export async function qrSvg(texto: string) {
  return QRCode.toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } });
}

// "K7Q2M9XW" → "K7Q2 M9XW", más fácil de leer y tipear.
export const codigoLegible = (codigo: string) => `${codigo.slice(0, 4)} ${codigo.slice(4)}`;
