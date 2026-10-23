import * as z from 'zod';

// Variables de entorno que la app necesita. Se revisan al compilar (next.config.ts): en producción, si falta
// alguna o es inválida, la compilación se corta con un mensaje claro en vez de publicar una app rota.
// Los mensajes nombran la variable, nunca muestran su valor.

const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: 'NEXT_PUBLIC_SUPABASE_URL: falta o no es una dirección (https://…supabase.co).' }),
  claveSupabase: z.string({ error: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: falta la clave pública de Supabase.' })
    .regex(/^(sb_publishable_|eyJ)/, { error: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: no parece la clave pública (sb_publishable_… o la anon).' }),
  NEXT_PUBLIC_SITE_URL: z.url({ error: 'NEXT_PUBLIC_SITE_URL: no es una dirección válida.' }).optional(),
});

// Una clave JWT "anon" dice su rol adentro: si dice service_role, es la secreta.
function rolDeJwt(clave: string) {
  try {
    const carga = clave.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(carga)) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export function problemasDeEntorno(env: Record<string, string | undefined>): string[] {
  const claveSupabase = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Las variables NEXT_PUBLIC_ llegan al navegador: una clave secreta ahí queda a la vista de cualquiera.
  if (claveSupabase?.startsWith('sb_secret_') || (claveSupabase?.startsWith('eyJ') && rolDeJwt(claveSupabase) === 'service_role')) {
    return ['La clave de Supabase cargada es la SECRETA: va la pública (publishable). Cambiala y rotá la secreta en Supabase.'];
  }
  const resultado = esquema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    claveSupabase,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message);
}
