// Vercel, al conectar Supabase, puede cargar la clave pública con cualquiera de los dos nombres.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurado = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
