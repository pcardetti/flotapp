'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

// Cliente del navegador: usa la misma sesión (cookies) que el servidor. Sirve para subir fotos
// directo a Storage sin pasar por nuestro servidor, que en el celular ahorra tiempo y datos.
let cliente: ReturnType<typeof createBrowserClient> | null = null;

// Modo demo (sólo en desarrollo): las fotos "se suben" sin salir del navegador.
const clienteDemo = {
  storage: { from: () => ({ upload: (ruta: string) => new Promise((ok) => setTimeout(() => ok({ data: { path: ruta }, error: null }), 900)) }) },
};

export function clienteNavegador() {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_FLOTAPP_DEMO === '1') return clienteDemo as unknown as ReturnType<typeof createBrowserClient>;
  cliente ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}
