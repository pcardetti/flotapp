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
  env: { ...process.env, FLOTAPP_DEMO: '1' },
});
proceso.on('exit', (codigo) => process.exit(codigo ?? 0));
