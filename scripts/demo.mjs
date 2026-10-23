// Levanta la app en modo demo: datos de ejemplo en memoria, sin Supabase ni cuentas.
// Uso: npm run demo (acepta los mismos argumentos que next dev, por ejemplo: npm run demo -- -p 3001).
// El rol se cambia con la cookie demo_rol (admin, jefe_taller, mecanico, chofer o lectura).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const next = join(dirname(require.resolve('next/package.json')), 'dist', 'bin', 'next');
const proceso = spawn(process.execPath, [next, 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  // Clave de prueba de Turnstile que publica Cloudflare: siempre aprueba, sirve para ver el formulario.
  env: { ...process.env, FLOTAPP_DEMO: '1', NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA' },
});
proceso.on('exit', (codigo) => process.exit(codigo ?? 0));
