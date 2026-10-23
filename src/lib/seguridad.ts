// Política de contenido (CSP) de cada página: sólo corre JavaScript propio, marcado con un nonce que cambia
// en cada pedido; las imágenes y las subidas van únicamente a Supabase; nadie puede incrustar la app.
export function politicaDeContenido(nonce: string, { supabase, desarrollo }: { supabase: string; desarrollo: boolean }) {
  const origenSupabase = supabase ? new URL(supabase).origin : '';
  const reglas: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'strict-dynamic': lo que cargan los scripts con nonce (los fragmentos de Next) también puede correr.
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    // React escribe estilos en línea (style="…"); no ejecutan código.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'blob:', 'data:', origenSupabase],
    'font-src': ["'self'"],
    'connect-src': ["'self'", origenSupabase, ...(desarrollo ? ['ws:'] : [])],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  const texto = Object.entries(reglas).map(([regla, fuentes]) => `${regla} ${fuentes.filter(Boolean).join(' ')}`);
  if (!desarrollo) texto.push('upgrade-insecure-requests');
  return texto.join('; ');
}

// Nonce de 128 bits en base64, como pide la especificación.
export function nuevoNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
