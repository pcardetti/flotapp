import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { crearClienteServidor } from '@/lib/supabase/server';

// Destino del enlace del mail de confirmación. Acepta los dos formatos que manda Supabase.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const sig = url.searchParams.get('siguiente') ?? '/empresas';
  const destino = sig.startsWith('/') && !sig.startsWith('//') ? sig : '/empresas';
  const supabase = await crearClienteServidor();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && tipo
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: new Error('Falta el código') };

  return NextResponse.redirect(new URL(error ? '/ingresar?error=enlace' : destino, url.origin));
}
