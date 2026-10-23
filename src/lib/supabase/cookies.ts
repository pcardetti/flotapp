// Cookies de la sesión de Supabase: JavaScript no las puede leer (HttpOnly), aunque la página tuviera un XSS;
// en producción viajan sólo por HTTPS; SameSite=Lax evita que otro sitio las use en pedidos que modifican datos.
export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
