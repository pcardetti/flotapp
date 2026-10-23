import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from './config';

// Un cliente nuevo por pedido: lee y escribe la sesión en las cookies del usuario.
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
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

export async function usuarioActual() {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? { id: data.claims.sub as string, email: (data.claims.email as string) ?? '' } : null;
}
