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
  // Cobros con Mercado Pago (sólo servidor): el token de la aplicación, la clave de los webhooks y el secreto que
  // comparte la app con la base para anotar pagos (lo genera la migración 0006).
  MP_ACCESS_TOKEN: z.string().regex(/^(APP_USR|TEST)-[\w-]{20,}$/, { error: 'MP_ACCESS_TOKEN: no parece un Access Token de Mercado Pago (APP_USR-… o TEST-…).' }).optional(),
  MP_WEBHOOK_SECRET: z.string().min(16, { error: 'MP_WEBHOOK_SECRET: no parece la clave secreta de los webhooks de Mercado Pago.' }).optional(),
  FLOTAPP_SECRETO_PAGOS: z.string().regex(/^[0-9a-f]{64}$/, { error: 'FLOTAPP_SECRETO_PAGOS: tiene que ser el valor que da la base (64 caracteres de 0-9 y a-f).' }).optional(),
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
    MP_ACCESS_TOKEN: env.MP_ACCESS_TOKEN || undefined,
    MP_WEBHOOK_SECRET: env.MP_WEBHOOK_SECRET || undefined,
    FLOTAPP_SECRETO_PAGOS: env.FLOTAPP_SECRETO_PAGOS || undefined,
  });
  const problemas = resultado.success ? [] : resultado.error.issues.map((i) => i.message);
  // Con Mercado Pago a medias, el cobro se abre pero los avisos de pago no se podrían anotar.
  if (env.MP_ACCESS_TOKEN && (!env.MP_WEBHOOK_SECRET || !env.FLOTAPP_SECRETO_PAGOS)) {
    problemas.push('Con MP_ACCESS_TOKEN hacen falta también MP_WEBHOOK_SECRET y FLOTAPP_SECRETO_PAGOS.');
  }
  return problemas;
}

// Lo recomendable que falta: no corta la compilación, pero conviene cargarlo.
export function avisosDeEntorno(env: Record<string, string | undefined>): string[] {
  const avisos: string[] = [];
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) avisos.push('Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY: el ingreso y el registro no tienen CAPTCHA.');
  if (!env.FLOTAPP_SECRETO_LIMITES) avisos.push('Falta FLOTAPP_SECRETO_LIMITES: el límite de intentos funciona, pero sin firmar sus claves.');
  if (!env.MP_ACCESS_TOKEN) avisos.push('Falta MP_ACCESS_TOKEN: los planes no se pueden pagar en línea (la prueba gratis sí funciona).');
  return avisos;
}
