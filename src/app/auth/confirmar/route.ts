import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { rutaInterna } from '@/lib/rutas';
import { crearClienteServidor } from '@/lib/supabase/server';

// Destino del enlace del mail de confirmación. Acepta los dos formatos que manda Supabase.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, url.origin));
  const destino = rutaInterna(url.searchParams.get('siguiente'));

  // Supabase no pudo validar el enlace (vencido o ya usado).
  if (url.searchParams.get('error_code') || url.searchParams.get('error')) return ir('/ingresar?error=enlace');

  const supabase = await crearClienteServidor();
  const code = url.searchParams.get('code');
  if (code) {
    // Si llega un código, Supabase ya confirmó el mail. Puede fallar el inicio de sesión automático
    // cuando el enlace se abre en otro navegador o en el celular: en ese caso basta con ingresar.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return ir(error ? '/ingresar?aviso=confirmado' : destino);
  }

  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    return ir(error ? '/ingresar?error=enlace' : destino);
  }
  return ir('/ingresar?error=enlace');
}
