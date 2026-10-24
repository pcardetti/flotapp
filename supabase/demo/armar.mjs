// Arma empresas_demo.sql (con una clave al azar para todas las cuentas de muestra) y usuarios-demo.md (las cuentas para
// entrar). Los dos archivos quedan fuera de git porque llevan la clave. Desde la raíz del repo: node supabase/demo/armar.mjs
// Con --clave=<texto> usa esa clave (sólo letras, números y guiones), por ejemplo para las pruebas locales.
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = dirname(fileURLToPath(import.meta.url));
const plantilla = readFileSync(join(carpeta, 'empresas_demo.plantilla.sql'), 'utf8');

export function claveAlAzar() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const pedazo = (n, abc) => Array.from({ length: n }, () => abc[randomInt(abc.length)]).join('');
  return `Flota-${pedazo(5, letras)}-${pedazo(4, '23456789')}`;
}

export function armar(clave) {
  if (!/^[A-Za-z0-9-]{10,40}$/.test(clave)) throw new Error('La clave tiene que tener entre 10 y 40 letras, números o guiones.');
  return plantilla.replace(':CLAVE:', clave);
}

// Empresas y cuentas, leídas de la plantilla para que la lista no se desactualice.
export function cuentas() {
  const empresas = new Map([...plantilla.matchAll(/^\s+\((\d+), '([^']+)', '(flota|taller|recapadora)'/gm)].map((m) => [Number(m[1]), { nombre: m[2], tipo: m[3] }]));
  return [...plantilla.matchAll(/^\s+\((\d+), (\d+), '([^']+@flotapp\.test)', (?:'([^']*)'|null), '(\w+)'\)/gm)].map((m) => ({
    empresa: empresas.get(Number(m[2])), email: m[3], nombre: m[4] ?? null, rol: m[5],
  }));
}

const ROL = { admin: 'Administrador', jefe_taller: 'Jefe de taller', mecanico: 'Mecánico', chofer: 'Chofer', lectura: 'Consulta', operario: 'Operario' };
const APP = { admin: 'Flotapp', jefe_taller: 'Flotapp', lectura: 'Flotapp', mecanico: 'App Taller', chofer: 'App Chofer', operario: 'Flotapp' };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const clave = process.argv.find((a) => a.startsWith('--clave='))?.slice(8) ?? claveAlAzar();
  writeFileSync(join(carpeta, 'empresas_demo.sql'), armar(clave));
  const filas = cuentas();
  const porEmpresa = Map.groupBy(filas, (c) => c.empresa.nombre);
  const md = [
    '# Cuentas de las empresas de muestra',
    '',
    'Entrás en https://flotapp-ten.vercel.app/ingresar con cualquiera de estos mails.',
    '',
    `**Clave (la misma para todas):** \`${clave}\``,
    '',
    'Los mails terminan en `@flotapp.test`: no reciben correo. No compartas este archivo: tiene la clave.',
    'El chofer de las flotas 1 a 4 está en viaje ahora; el de las demás puede empezar uno.',
    '',
    ...[...porEmpresa].flatMap(([empresa, lista]) => [
      `## ${empresa}`,
      '',
      '| Rol | Entra a | Mail | Nombre |',
      '|---|---|---|---|',
      ...lista.map((c) => `| ${ROL[c.rol]} | ${APP[c.rol]} | ${c.email} | ${c.nombre ?? 'su chofer número 1'} |`),
      '',
    ]),
    'Para sacar todo: ejecutá `borrar_empresas_demo.sql` en Supabase → SQL Editor.',
    '',
  ].join('\n');
  writeFileSync(join(carpeta, 'usuarios-demo.md'), md);
  console.log(`Listo: empresas_demo.sql y usuarios-demo.md (${filas.length} cuentas, ${porEmpresa.size} empresas). La clave está sólo en esos archivos.`);
}
