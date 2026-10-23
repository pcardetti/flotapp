import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

const BALDE = 'fotos';

// Las fotos son privadas: para mostrarlas se piden enlaces firmados que vencen en una hora.
export async function firmarFotos(rutas: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unicas = [...new Set(rutas.filter((r): r is string => Boolean(r)))];
  if (!unicas.length) return {};
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(BALDE).createSignedUrls(unicas, 3600);
  avisarError('firmarFotos', error);
  return Object.fromEntries((data ?? []).filter((f) => f.signedUrl && f.path).map((f) => [f.path as string, f.signedUrl as string]));
}

// Sólo se aceptan rutas dentro de la carpeta de la empresa (la base además lo controla al subir).
export function rutasValidas(org: string, valores: FormDataEntryValue[]) {
  return valores
    .filter((v): v is string => typeof v === 'string')
    .filter((v) => v.startsWith(`${org}/`) && /^[0-9a-f-]{36}\/[a-z]+\/[A-Za-z0-9._-]+$/.test(v))
    .slice(0, 12);
}
