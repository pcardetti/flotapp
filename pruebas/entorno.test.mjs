import assert from 'node:assert/strict';
import test from 'node:test';
import { avisosDeEntorno, problemasDeEntorno } from '../src/lib/entorno.ts';

const URL = 'https://abcdefgh.supabase.co';
// JWT de ejemplo armados acá (no son claves reales): sólo importa el rol que llevan adentro.
const jwt = (rol) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: rol })).toString('base64url')}.firma`;

test('una configuración completa no tiene problemas', () => {
  assert.deepEqual(problemasDeEntorno({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }), []);
  assert.deepEqual(problemasDeEntorno({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }), []);
});

test('avisa qué falta, sin mostrar valores', () => {
  const p = problemasDeEntorno({ NEXT_PUBLIC_SUPABASE_URL: 'valor-roto-987', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'clave-rara-123' });
  assert.equal(p.length, 2);
  assert.ok(p.every((x) => !x.includes('clave-rara-123') && !x.includes('valor-roto-987')));
  assert.equal(problemasDeEntorno({}).length, 2);
});

test('Turnstile y el secreto de los límites son opcionales, pero si están tienen que servir', () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' };
  assert.deepEqual(problemasDeEntorno({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAabcdefghijklmn', FLOTAPP_SECRETO_LIMITES: 'x'.repeat(40) }), []);
  assert.match(problemasDeEntorno({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'cualquiera' })[0], /TURNSTILE/);
  assert.match(problemasDeEntorno({ ...base, FLOTAPP_SECRETO_LIMITES: 'corto' })[0], /32 caracteres/);
  assert.equal(avisosDeEntorno(base).length, 2);
  assert.equal(avisosDeEntorno({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAA', FLOTAPP_SECRETO_LIMITES: 'x' }).length, 0);
});

test('frena una clave secreta puesta en una variable pública', () => {
  for (const secreta of ['sb_secret_abc', jwt('service_role')]) {
    const p = problemasDeEntorno({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secreta });
    assert.match(p[0], /SECRETA/);
  }
});
