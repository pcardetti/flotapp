'use server';

import { UUID } from '@/lib/empresa';
import { avisarError, crearClienteServidor, usuarioActual } from '@/lib/supabase/server';

const CARPETAS = ['fallas', 'ordenes', 'gastos', 'documentos', 'chequeos'];
export type Carpeta = 'fallas' | 'ordenes' | 'gastos' | 'documentos' | 'chequeos';

// Lugar para una foto nueva. El servidor elige la ruta y le pide a Storage una URL firmada (vale 2 horas);
// Storage sólo la da si la persona puede subir fotos en esa empresa (la misma regla de la base, fotos_subir).
// Así el navegador sube directo, sin necesitar la sesión, que queda en cookies que JavaScript no puede leer.
export async function pedirSubida(org: string, carpeta: Carpeta): Promise<{ ruta: string; url: string } | { error: string }> {
  if (!UUID.test(org) || !CARPETAS.includes(carpeta)) return { error: 'No se puede subir la foto acá.' };
  if (!(await usuarioActual())) return { error: 'Tu sesión venció. Volvé a ingresar.' };
  const ruta = `${org}/${carpeta}/${crypto.randomUUID()}.jpg`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from('fotos').createSignedUploadUrl(ruta);
  if (error || !data) {
    avisarError('pedirSubida', error ? { message: error.message } : null);
    return { error: 'No pudimos preparar la subida. Probá de nuevo.' };
  }
  return { ruta, url: data.signedUrl };
}
