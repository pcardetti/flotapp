import { modoDemo } from '@/lib/demo/activo';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

// Para monitoreo: 200 si la app y la base responden, 503 si no. No muestra configuración.
export async function GET() {
  const inicio = performance.now();
  let base = 'sin configurar';
  if (modoDemo()) base = 'demo';
  else if (supabaseConfigurado()) {
    try {
      // Una función liviana de la base que cualquiera puede llamar: prueba que Postgres responde.
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ver_invitacion`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: '0' }),
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      base = r.ok ? 'ok' : 'error';
    } catch {
      base = 'sin respuesta';
    }
  }
  const sana = base === 'ok' || base === 'demo';
  return Response.json(
    { estado: sana ? 'ok' : 'degradado', base, ms: Math.round(performance.now() - inicio), version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local' },
    { status: sana ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
