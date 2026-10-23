import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { modoDemo } from '@/lib/demo/activo';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from '@/lib/supabase/config';

const PRIVADAS = ['/empresa', '/empresas', '/chofer', '/taller', '/u', '/imprimir'];

// Renueva la sesión en cada pedido y manda al inicio de sesión a quien entra sin estar logueado.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!supabaseConfigurado() || modoDemo()) return respuesta;

  // Si la dirección de confirmación no está autorizada en Supabase, el enlace del mail vuelve a la raíz.
  const params = request.nextUrl.searchParams;
  if (request.nextUrl.pathname === '/' && (params.has('code') || params.has('error_code'))) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/auth/confirmar';
    return NextResponse.redirect(destino);
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(aGuardar, encabezados) {
        aGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        aGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(encabezados).forEach(([clave, valor]) => respuesta.headers.set(clave, valor));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;
  if (!data?.claims && PRIVADAS.some((p) => ruta === p || ruta.startsWith(p + '/'))) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/ingresar';
    destino.search = '?siguiente=' + encodeURIComponent(ruta + request.nextUrl.search);
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

// Archivos estáticos, íconos y manifiestos de instalación no pasan por la sesión.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifests/|icono/|(?:.*/)?apple-icon|.*\\.(?:svg|png|jpg|jpeg|webp|webmanifest)$).*)'],
};
