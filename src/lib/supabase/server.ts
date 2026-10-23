import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { modoDemo } from '@/lib/demo/activo';
import { agenteCliente, ipCliente } from '@/lib/peticion';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from './config';
import { OPCIONES_COOKIE } from './cookies';

function clienteSupabase(almacen: Awaited<ReturnType<typeof cookies>>, origen: Record<string, string>) {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: OPCIONES_COOKIE,
    // La base anota en la auditoría desde dónde se hizo cada cambio: los pedidos salen de este servidor,
    // así que la IP y el navegador de la persona viajan en cabeceras propias.
    global: { headers: origen },
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(aGuardar) {
        try {
          aGuardar.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies; el proxy ya renueva la sesión.
        }
      },
    },
  });
}

// Un cliente nuevo por pedido: lee y escribe la sesión en las cookies del usuario.
export async function crearClienteServidor() {
  const almacen = await cookies();
  if (modoDemo()) {
    const { clienteDemo } = await import('@/lib/demo/cliente');
    return clienteDemo(almacen.get('demo_rol')?.value) as unknown as ReturnType<typeof clienteSupabase>;
  }
  return clienteSupabase(almacen, { 'x-flotapp-ip': await ipCliente(), 'x-flotapp-agente': await agenteCliente() });
}

// Una consulta que falla no debe pasar desapercibida: queda en el registro del servidor.
export function avisarError(donde: string, error: { message: string; code?: string } | null) {
  if (error) console.error(`[${donde}] ${error.code ?? ''} ${error.message}`);
}

export async function usuarioActual() {
  if (!supabaseConfigurado() && !modoDemo()) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? { id: data.claims.sub as string, email: (data.claims.email as string) ?? '' } : null;
}
