import * as z from 'zod';

// Variables de entorno que la app necesita. Se revisan al compilar (next.config.ts): en producción, si falta
// alguna o es inválida, la compilación se corta con un mensaje claro en vez de publicar una app rota.
// Los mensajes nombran la variable, nunca muestran su valor.

const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: 'NEXT_PUBLIC_SUPABASE_URL: falta o no es una dirección (https://…supabase.co).' }),
  claveSupabase: z.string({ error: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: falta la clave pública de Supabase.' })
    .regex(/^(sb_publishable_|eyJ)/, { error: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: no parece la clave pública (sb_publishable_… o la anon).' }),
  NEXT_PUBLIC_SITE_URL: z.url({ error: 'NEXT_PUBLIC_SITE_URL: no es una dirección válida.' }).optional(),
  // Clave pública del widget de Cloudflare Turnstile (la secreta va sólo en Supabase).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().regex(/^[0-3]x[0-9A-Za-z_-]{16,}$/, { error: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY: no parece una clave de sitio de Turnstile (0x4AAA…).' }).optional(),
  // Firma las claves del límite de intentos; sólo en el servidor (sin NEXT_PUBLIC_).
  FLOTAPP_SECRETO_LIMITES: z.string().min(32, { error: 'FLOTAPP_SECRETO_LIMITES: tiene que tener al menos 32 caracteres al azar.' }).optional(),
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
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
    FLOTAPP_SECRETO_LIMITES: env.FLOTAPP_SECRETO_LIMITES || undefined,
  });
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message);
}

// Lo recomendable que falta: no corta la compilación, pero conviene cargarlo.
export function avisosDeEntorno(env: Record<string, string | undefined>): string[] {
  const avisos: string[] = [];
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) avisos.push('Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY: el ingreso y el registro no tienen CAPTCHA.');
  if (!env.FLOTAPP_SECRETO_LIMITES) avisos.push('Falta FLOTAPP_SECRETO_LIMITES: el límite de intentos funciona, pero sin firmar sus claves.');
  return avisos;
}
