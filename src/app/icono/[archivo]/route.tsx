import { notFound } from 'next/navigation';
import { ARCHIVOS_ICONO, imagenIcono, leerArchivoIcono } from '@/lib/iconos';

// Íconos de instalación de las tres apps: se generan una sola vez, al compilar.
export const dynamicParams = false;

export function generateStaticParams() {
  return ARCHIVOS_ICONO.map((archivo) => ({ archivo }));
}

export async function GET(_: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const icono = leerArchivoIcono((await params).archivo);
  if (!icono) notFound();
  return imagenIcono(icono.app, icono.variante, icono.tamano);
}
