import assert from 'node:assert/strict';
import test from 'node:test';
import { nuevoNonce, politicaDeContenido } from '../src/lib/seguridad.ts';

const SUPABASE = 'https://abcdefgh.supabase.co';

test('en producción sólo corren scripts con el nonce y nadie puede incrustar la app', () => {
  const csp = politicaDeContenido('N0NCE', { supabase: SUPABASE, desarrollo: false });
  assert.match(csp, /script-src 'self' 'nonce-N0NCE' 'strict-dynamic';/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /img-src 'self' blob: data: https:\/\/abcdefgh\.supabase\.co;/);
  assert.match(csp, /connect-src 'self' https:\/\/abcdefgh\.supabase\.co;/);
  assert.match(csp, /upgrade-insecure-requests$/);
});

test('en desarrollo permite lo que necesita la recarga en caliente', () => {
  const csp = politicaDeContenido('N', { supabase: SUPABASE, desarrollo: true });
  assert.match(csp, /'unsafe-eval'/);
  assert.match(csp, /connect-src 'self' https:\/\/abcdefgh\.supabase\.co ws:/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test('sin Supabase configurado no queda una fuente vacía', () => {
  const csp = politicaDeContenido('N', { supabase: '', desarrollo: false });
  assert.match(csp, /img-src 'self' blob: data:;/);
});

test('cada pedido recibe un nonce distinto de 128 bits', () => {
  const a = nuevoNonce();
  assert.equal(Buffer.from(a, 'base64').length, 16);
  assert.notEqual(a, nuevoNonce());
});
