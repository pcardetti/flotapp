import { createHash } from 'node:crypto';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from '@/lib/supabase/config';

// Estado de la conexión, para revisar una publicación sin entrar a los paneles de Vercel o Supabase.
// Nunca devuelve valores de claves ni direcciones: sólo qué variables existen y cómo responde la base.
export const dynamic = 'force-dynamic';

const sinCache = { headers: { 'Cache-Control': 'no-store' } };

export async function GET() {
  const variables = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
  const funciones = process.env.VERCEL_REGION ?? 'local';
  if (!supabaseConfigurado()) return Response.json({ funciones, variables, supabase: 'faltan variables' }, sinCache);

  const pedir = (ruta: string) => fetch(SUPABASE_URL + ruta, { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' });
  try {
    // La primera consulta abre la conexión; las demás miden la distancia real hasta la base.
    const tiempos: number[] = [];
    let ajustes: Response | null = null;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      ajustes = await pedir('/auth/v1/settings');
      tiempos.push(performance.now() - t0);
    }
    if (!ajustes?.ok) return Response.json({ funciones, variables, supabase: `rechaza la clave (${ajustes?.status})` }, sinCache);
    const auth = await ajustes.json();

    const tabla = await pedir('/rest/v1/organizaciones?select=id&limit=1');
    const cuerpo = await tabla.json().catch(() => ({}));
    const esquema =
      cuerpo?.code === '42501' ? 'aplicado'
      : cuerpo?.code === 'PGRST205' || tabla.status === 404 ? 'falta ejecutar el SQL'
      : tabla.status === 200 ? 'incompleto (el SQL no terminó)'
      : `desconocido (${tabla.status})`;

    // La migración 0002 (viajes, taller, tablero) agrega funciones que cualquiera puede llamar, como ver_invitacion.
    const funcion = await fetch(SUPABASE_URL + '/rest/v1/rpc/ver_invitacion', {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: '0' }), cache: 'no-store',
    });
    const viajes = funcion.ok ? 'aplicada' : funcion.status === 404 ? 'falta ejecutar 0002' : `desconocido (${funcion.status})`;

    return Response.json(
      {
        funciones,
        variables,
        supabase: 'conectado',
        // Huella del proyecto: permite comparar dos instalaciones sin mostrar la dirección.
        proyecto: createHash('sha256').update(SUPABASE_URL.replace(/\/$/, '')).digest('hex').slice(0, 8),
        esquema,
        migracion_viajes: viajes,
        registro_abierto: !auth.disable_signup,
        confirmacion_por_mail: !auth.mailer_autoconfirm,
        demora_a_la_base_ms: Math.round(Math.min(...tiempos.slice(1))),
      },
      sinCache,
    );
  } catch (e) {
    console.error('[estado]', e instanceof Error ? `${e.name}: ${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : e);
    return Response.json({ funciones, variables, supabase: 'sin respuesta' }, sinCache);
  }
}
