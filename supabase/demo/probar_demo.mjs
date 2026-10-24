// Prueba las empresas de muestra en un Postgres local (PGlite) antes de cargarlas en Supabase: que el script corra
// entero, que los datos sean coherentes, que cada cuenta vea sólo lo suyo, que la app aguante a las 8 flotas
// trabajando a la vez y que el borrado deje la base como estaba. Desde la raíz del repo: node supabase/demo/probar_demo.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armar } from './armar.mjs';

const carpeta = dirname(fileURLToPath(import.meta.url));
const raiz = join(carpeta, '..', '..');
const modulo = (ruta) => import(pathToFileURL(join(raiz, 'node_modules', '@electric-sql', 'pglite', 'dist', ruta)).href);
const { PGlite } = await modulo('index.js');
const { pgcrypto } = await modulo('contrib/pgcrypto.js');
const db = new PGlite({ extensions: { pgcrypto } });

// Lo de Supabase que usan las migraciones y la carga: auth (usuarios e identidades), pgcrypto en extensions y Storage.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema extensions; create extension pgcrypto schema extensions;
  create schema auth;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud varchar(255), role varchar(255), email varchar(255), encrypted_password varchar(255),
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    last_sign_in_at timestamptz, confirmation_token varchar(255), recovery_token varchar(255), email_change_token_new varchar(255), email_change varchar(255)
  );
  create table auth.identities (
    provider_id text not null, user_id uuid not null references auth.users on delete cascade, identity_data jsonb not null, provider text not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, id uuid primary key default gen_random_uuid(), unique (provider_id, provider)
  );
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`);
const migraciones = join(raiz, 'supabase', 'migrations');
for (const archivo of readdirSync(migraciones).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(migraciones, archivo), 'utf8'));
console.log('Migraciones aplicadas');

let fallas = 0;
function ok(cond, msg) { console.log((cond ? '  OK   ' : '  FALLA ') + msg); if (!cond) fallas++; }
const filas = async (sql, p = []) => (await db.query(sql, p)).rows;
const una = async (sql, p = []) => (await db.query(sql, p)).rows[0];
async function como(uid, sql, p = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await db.query(sql, p); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const unaComo = async (uid, sql, p) => (await como(uid, sql, p)).rows[0];
async function error(uid, sql, p) { try { await como(uid, sql, p); return null; } catch (e) { return e.message.split('\n')[0]; } }
const leer = (archivo) => readFileSync(join(carpeta, archivo), 'utf8');
const hoy = (await una(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`)).d;
const desdeMes = hoy.slice(0, 8) + '01';

// Una empresa que no es de muestra: la carga y el borrado no la pueden tocar.
const REAL = 'aaaaaaaa-1111-4111-8111-000000000001';
await db.query(`insert into auth.users (id, email) values ($1, 'duenio@transporte-real.com.ar')`, [REAL]);
const orgReal = (await unaComo(REAL, `select crear_organizacion('Transporte Real', 'flota') id`)).id;
await como(REAL, `insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'AE 111 AA', 'tractor', 'Scania', 'R 450', 1000)`, [orgReal]);
await como(REAL, `insert into gastos (organizacion_id, categoria, monto) values ($1, 'peaje', 5000)`, [orgReal]);
const fotoReal = async () => JSON.stringify(await una(`select (select count(*) from unidades where organizacion_id = $1) u, (select count(*) from gastos where organizacion_id = $1) g,
  (select count(*) from miembros where organizacion_id = $1) m, (select count(*) from suscripciones where organizacion_id = $1) s,
  (select count(*) from tipos_documento where organizacion_id = $1) t, (select count(*) from auth.users where id = $2) a`, [orgReal, REAL]));
const realAntes = await fotoReal();

console.log('Carga');
const CLAVE = 'Prueba-local-1234';
const script = armar(CLAVE);
let t0 = performance.now();
const resumen = (await db.exec(script)).at(-1).rows;
const msCarga = Math.round(performance.now() - t0);
console.table(resumen);
ok(resumen.length === 10, `Se cargaron 8 flotas, un taller y una recapadora (${(msCarga / 1000).toFixed(1)} s)`);
let segunda = '';
try { await db.exec(script); } catch (e) { segunda = e.message; }
ok(/ya están cargadas/.test(segunda), 'Correrlo dos veces no duplica nada: avisa que ya están cargadas');
ok((await una(`select count(*)::int n from organizaciones where id::text like 'de000000-%'`)).n === 10, 'Después del segundo intento sigue habiendo 10 empresas');
let sinClave = '';
try { await db.exec(leer('empresas_demo.plantilla.sql')); } catch (e) { sinClave = e.message; }
ok(/ya están cargadas|Falta la clave/.test(sinClave), 'La plantilla sin clave no se puede ejecutar');

console.log('Cuentas');
const cuentas = await filas(`select u.id, u.email, m.organizacion_id org, m.rol::text rol, m.chofer_id from auth.users u join miembros m on m.user_id = u.id where u.email like '%@flotapp.test' order by u.email`);
ok(cuentas.length === 35, `35 cuentas, cada una en su empresa (${cuentas.length})`);
ok((await una(`select count(*)::int n from auth.identities where user_id::text like 'de00a000-%'`)).n === 35, 'Cada cuenta tiene su identidad de mail (la pide Supabase para entrar)');
ok((await una(`select count(*)::int n from auth.users where id::text like 'de00a000-%' and encrypted_password = extensions.crypt($1, encrypted_password)`, [CLAVE])).n === 35,
  'La clave queda cifrada con bcrypt y coincide en las 35 cuentas');
ok((await una(`select count(*)::int n from auth.users where id::text like 'de00a000-%' and (confirmation_token is null or recovery_token is null or email_change_token_new is null or email_change is null or email_confirmed_at is null)`)).n === 0,
  'Mails confirmados y sin campos vacíos que traben el ingreso');

console.log('Datos');
const UNIDADES = { 1: 14, 2: 25, 3: 8, 4: 11, 5: 5, 6: 7, 7: 18, 8: 9 };
const porFlota = await filas(`select o.nombre, right(o.id::text, 2)::int n, count(u.*)::int unidades from organizaciones o left join unidades u on u.organizacion_id = o.id
  where o.id::text like 'de000000-%' and o.tipo = 'flota' group by o.id order by o.id`);
ok(porFlota.every((f) => f.unidades === UNIDADES[f.n]), 'Cada flota tiene sus unidades: ' + porFlota.map((f) => `${f.nombre} ${f.unidades}`).join(', '));
const viajesUnidad = await filas(`select u.dominio, u.estado::text, count(v.*)::int viajes from unidades u left join viajes v on v.unidad_id = u.id and v.inicio > now() - interval '21 days'
  where u.organizacion_id::text like 'de000000-%' and u.tipo in ('tractor', 'chasis') and u.estado <> 'baja' group by u.id`);
ok(viajesUnidad.filter((u) => u.estado === 'operativa').every((u) => u.viajes >= 8), `Cada unidad en servicio viajó casi todos los días (mínimo ${Math.min(...viajesUnidad.filter((u) => u.estado === 'operativa').map((u) => u.viajes))} viajes en 20 días)`);
const estados = await una(`select
  (select array_agg(distinct estado::text order by estado::text) from fallas where organizacion_id::text like 'de000000-%') fallas,
  (select array_agg(distinct estado::text order by estado::text) from ordenes where organizacion_id::text like 'de000000-%') ordenes,
  (select array_agg(distinct estado::text order by estado::text) from unidades where organizacion_id::text like 'de000000-%') unidades,
  (select array_agg(distinct estado::text order by estado::text) from neumaticos where organizacion_id::text like 'de000000-%') cubiertas,
  (select array_agg(distinct tipo::text order by tipo::text) from neumatico_eventos where organizacion_id::text like 'de000000-%') eventos,
  (select array_agg(distinct categoria::text order by categoria::text) from gastos where organizacion_id::text like 'de000000-%') gastos,
  (select array_agg(distinct origen order by origen) from fallas where organizacion_id::text like 'de000000-%') origenes`);
ok(['abierta', 'descartada', 'en_reparacion', 'resuelta'].every((x) => estados.fallas.includes(x)), 'Hay fallas abiertas, en reparación, resueltas y descartadas');
ok(['abierta', 'cerrada', 'en_proveedor'].every((x) => estados.ordenes.includes(x)), 'Hay órdenes abiertas, en el taller externo y cerradas');
ok(['baja', 'operativa', 'taller'].every((x) => estados.unidades.includes(x)), 'Hay unidades en servicio, en el taller y dadas de baja');
ok(['baja', 'deposito', 'montado', 'recapado'].every((x) => estados.cubiertas.includes(x)), 'Hay cubiertas montadas, en depósito, en la recapadora y de baja');
ok(['alta', 'baja', 'envio', 'medicion', 'montaje', 'recapado', 'rotacion'].every((x) => estados.eventos.includes(x)), 'Historial de cubiertas: ' + estados.eventos.join(', '));
ok(['combustible', 'lavado', 'multa', 'neumaticos', 'otro', 'patente', 'peaje', 'seguro', 'viatico'].every((x) => estados.gastos.includes(x)), 'Gastos de todas las categorías');
ok(['chequeo', 'taller', 'viaje'].every((x) => estados.origenes.includes(x)), 'Fallas del chequeo, avisadas en viaje y encontradas en el taller');
const fueraDeLugar = await una(`select
  (select count(*)::int from viajes where organizacion_id::text like 'de000000-%' and estado = 'terminado' and (fin <= inicio or km_fin < km_inicio)) viajes,
  (select count(*)::int from gastos where organizacion_id::text like 'de000000-%' and (fecha > (now() at time zone 'America/Argentina/Buenos_Aires')::date or fecha < (now() - interval '175 days')::date)) gastos,
  (select count(*)::int from viajes where organizacion_id::text like 'de000000-%' and inicio > now()) futuros,
  (select count(*)::int from neumaticos n where organizacion_id::text like 'de000000-%' and (km_total < 0 or km_vida < 0 or km_vida > km_total + 1)) cubiertas,
  (select count(*)::int from documentos where organizacion_id::text like 'de000000-%' and vence < current_date) vencidos`);
ok(fueraDeLugar.viajes + fueraDeLugar.gastos + fueraDeLugar.futuros + fueraDeLugar.cubiertas === 0, 'Fechas, kilómetros y contadores de cubiertas coherentes');
ok(fueraDeLugar.vencidos >= 8, `Cada flota tiene algún vencimiento atrasado para mostrar (${fueraDeLugar.vencidos})`);

console.log('Lo que ve cada cuenta (verificar_empresas_demo.sql)');
const verificar = async () => (await db.exec(leer('verificar_empresas_demo.sql'))).at(-1).rows;
let control = await verificar();
const malas = control.filter((f) => f.resultado !== 'ok');
ok(malas.length === 0, `${control.length} pruebas, ${malas.length} con problemas`);
for (const m of malas) console.log('        ', m.empresa, m.cuenta, m.prueba, '→', m.detalle);
for (const f of control.filter((x) => x.prueba.startsWith('Tablero del mes') && x.cuenta.startsWith('admin.'))) console.log('        ', f.empresa.padEnd(26), f.detalle);

console.log('Tablero de cada flota en los 4 períodos');
const flotas = [];
for (let n = 1; n <= 8; n++) {
  const org = `de000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const de = (rol) => cuentas.find((c) => c.org === org && c.rol === rol);
  flotas.push({ n, org, nombre: porFlota[n - 1].nombre, admin: de('admin').id, chofer: de('chofer').id, choferId: de('chofer').chofer_id, mecanico: de('mecanico').id, jefe: de('jefe_taller')?.id });
}
const rangos = {
  mes: [desdeMes, hoy],
  anterior: [(await una(`select (date_trunc('month', $1::date) - interval '1 month')::date::text d`, [hoy])).d, (await una(`select (date_trunc('month', $1::date) - interval '1 day')::date::text d`, [hoy])).d],
  '90': [(await una(`select ($1::date - 89)::text d`, [hoy])).d, hoy],
  anio: [hoy.slice(0, 5) + '01-01', hoy],
};
const tiempos = [];
const tabla = [];
for (const f of flotas) {
  const fila = { flota: f.nombre };
  for (const [p, [d, h]] of Object.entries(rangos)) {
    t0 = performance.now();
    const t = (await unaComo(f.admin, 'select tablero($1, $2, $3) t', [f.org, d, h])).t;
    tiempos.push(performance.now() - t0);
    const consumo = t.totales.km ? (t.totales.litros / t.totales.km) * 100 : null;
    const porKm = t.totales.km ? t.totales.costo / t.totales.km : null;
    fila[p] = t.totales.km ? `${Math.round(t.totales.km / 1000)} mil km · ${consumo.toFixed(1)} l · $${Math.round(porKm)}/km` : 'sin km';
    if (t.totales.km) {
      ok(consumo > 15 && consumo < 45 && porKm > 300 && porKm < 3000, `${f.nombre}, ${p}: consumo ${consumo.toFixed(1)} l/100 km y $${Math.round(porKm)} por km, razonables`);
      const unidadesRaras = t.por_unidad.filter((u) => Number(u.km) > 0 && Number(u.litros) > 0 && ((u.litros / u.km) * 100 < 12 || (u.litros / u.km) * 100 > 50));
      ok(unidadesRaras.length === 0, `${f.nombre}, ${p}: ninguna unidad con consumo imposible` + (unidadesRaras.length ? ' → ' + unidadesRaras.map((u) => u.dominio).join(', ') : ''));
    }
  }
  tabla.push(fila);
}
console.table(tabla);
ok(Math.max(...tiempos) < 3000, `El tablero tarda como mucho ${Math.round(Math.max(...tiempos))} ms en la base local (promedio ${Math.round(tiempos.reduce((a, b) => a + b) / tiempos.length)} ms)`);

console.log('Las 8 flotas trabajando a la vez (3 rondas intercaladas)');
const itemsOk = async (tipo) => Object.fromEntries((await filas(`select clave from items_chequeo where solo_tipos is null or $1 = any (solo_tipos)`, [tipo])).map((r) => [r.clave, { estado: 'ok' }]));
let iniciados = 0, terminados = 0, cargas = 0, arreglos = 0, peajes = 0, erroresRonda = [];
for (let ronda = 1; ronda <= 3; ronda++) {
  for (const f of flotas) {
    try {
      const enCurso = await unaComo(f.chofer, `select id, km_inicio from viajes where user_id = auth.uid() and estado = 'en_curso'`);
      const unidad = await unaComo(f.chofer, `select id, qr_token, km, tipo::text, estado::text from unidades where chofer_id = $1`, [f.choferId]);
      if (enCurso) {
        await como(f.chofer, `select terminar_viaje($1, $2, 35::smallint, 'Sin novedad')`, [enCurso.id, enCurso.km_inicio + 340 + ronda]);
        terminados++;
      } else if (unidad.estado === 'operativa') {
        const r = (await unaComo(f.chofer, `select iniciar_viaje($1, $2, 85::smallint, $3::jsonb, 'Ronda de prueba') r`, [unidad.qr_token, unidad.km, JSON.stringify(await itemsOk(unidad.tipo))])).r;
        if (r.estado === 'iniciado') iniciados++;
      }
      await como(f.chofer, `insert into gastos (organizacion_id, categoria, monto, litros, unidad_id, chofer_id) values ($1, 'combustible', 430000, 250, $2, $3)`, [f.org, unidad.id, f.choferId]);
      cargas++;
      const abierta = await unaComo(f.mecanico, `select id, unidad_id from fallas where estado = 'abierta' and gravedad <> 'critica' order by creada_en limit 1`);
      if (abierta) {
        await como(f.mecanico, `select registrar_trabajo($1, 'correctivo', 'Arreglo de la ronda de prueba', 'Quedó bien', '{}', 15000, 25000, null, array[$2]::uuid[])`, [abierta.unidad_id, abierta.id]);
        arreglos++;
      }
      await como(f.admin, `insert into gastos (organizacion_id, categoria, monto, descripcion) values ($1, 'peaje', 8200, 'Peaje de la ronda')`, [f.org]);
      peajes++;
      await como(f.admin, 'select tablero($1, $2, $3)', [f.org, desdeMes, hoy]);
    } catch (e) {
      erroresRonda.push(`${f.nombre}, ronda ${ronda}: ${e.message.split('\n')[0]}`);
    }
  }
}
ok(erroresRonda.length === 0, `Sin errores: ${iniciados} viajes iniciados, ${terminados} terminados, ${cargas} cargas de combustible del chofer, ${arreglos} fallas resueltas, ${peajes} gastos de la administración` + (erroresRonda.length ? '\n         ' + erroresRonda.join('\n         ') : ''));
const [A, B] = flotas;
const unidadB = await una(`select id, qr_token from unidades where organizacion_id = $1 and tipo = 'tractor' and estado = 'operativa' limit 1`, [B.org]);
ok((await como(A.admin, `update unidades set km = 0 where organizacion_id = $1`, [B.org])).affectedRows === 0, 'Un administrador no puede tocar las unidades de otra flota');
ok((await error(A.admin, `insert into gastos (organizacion_id, categoria, monto) values ($1, 'peaje', 1)`, [B.org])) !== null, 'Ni cargarle gastos a otra flota');
ok(/No encontramos/.test((await error(A.chofer, `select iniciar_viaje($1, 9999999, 80::smallint, '{}'::jsonb)`, [unidadB.qr_token])) ?? ''), 'Un chofer no puede salir con una unidad de otra flota');
ok(/No encontramos/.test((await error(A.mecanico, `select registrar_trabajo($1, 'correctivo', 'x', 'x')`, [unidadB.id])) ?? ''), 'Un mecánico no puede cargar trabajos en otra flota');
ok((await unaComo(A.chofer, `select count(*)::int n from viajes where organizacion_id = $1`, [B.org])).n === 0, 'Ni ver sus viajes');
ok(/gastos/.test((await error(A.chofer, `insert into gastos (organizacion_id, categoria, monto, chofer_id) values ($1, 'viatico', 1000, (select id from choferes where organizacion_id = $1 and id <> $2 limit 1))`, [A.org, A.choferId])) ?? 'gastos'),
  'Un chofer no puede cargar gastos a nombre de otro chofer');

const F1 = flotas[0], F5 = flotas[4], F6 = flotas[5];
ok(/permite hasta 5/.test((await error(F5.admin, `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'AH 001 ZZ', 'chasis', 'Ford', 'Cargo 1723')`, [F5.org])) ?? ''), 'Fletes del Norte (plan Inicial, 5 de 5) no puede sumar otra unidad y se le ofrece subir de plan');
await como(F1.admin, `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'AH 001 ZZ', 'semirremolque', 'Helvética', 'Sider')`, [F1.org]);
ok(/permite hasta 15/.test((await error(F1.admin, `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'AH 002 ZZ', 'semirremolque', 'Helvética', 'Sider')`, [F1.org])) ?? ''), 'Transportes Cordillera llega a 15 de 15 y la 16 no entra');
const libre = await una(`select u.id from unidades u where u.organizacion_id = $1 and u.estado = 'operativa' and u.tipo = 'tractor'
  and not exists (select 1 from viajes v where v.unidad_id = u.id and v.estado = 'en_curso') limit 1`, [F1.org]);
const ordenNueva = (await unaComo(F1.jefe, `select abrir_orden($1, 'Revisión general de la ronda', 'preventivo', '{}', true) id`, [libre.id])).id;
ok((await una('select estado::text e from unidades where id = $1', [libre.id])).e === 'taller', 'El jefe de taller abre una orden y la unidad queda en el taller');
await como(F1.mecanico, `select cerrar_orden($1, 'Listo', '{}', 60000, 40000, null)`, [ordenNueva]);
ok((await una('select estado::text e from unidades where id = $1', [libre.id])).e === 'operativa', 'Al cerrarla, la unidad vuelve a estar en servicio');

await db.query(`update suscripciones set estado = 'cancelada', periodo_hasta = now() - interval '1 day' where organizacion_id = $1`, [F6.org]);
ok(/modo consulta/.test((await error(F6.admin, `insert into gastos (organizacion_id, categoria, monto) values ($1, 'peaje', 1000)`, [F6.org])) ?? ''), 'Con la cuenta vencida, la administración no puede cargar gastos');
ok(/modo consulta/.test((await error(F6.chofer, `insert into gastos (organizacion_id, categoria, monto, chofer_id) values ($1, 'peaje', 1000, $2)`, [F6.org, F6.choferId])) ?? ''), 'Ni el chofer');
ok((await unaComo(F6.admin, 'select tablero($1, $2, $3) t', [F6.org, desdeMes, hoy])).t.totales.km > 0, 'Pero se sigue viendo el tablero');
await db.query(`update suscripciones set estado = 'activa', periodo_hasta = null where organizacion_id = $1`, [F6.org]);

const TALLER = 'de000000-0000-4000-8000-000000000009', RECAP = 'de000000-0000-4000-8000-000000000010';
const operario = cuentas.find((c) => c.org === TALLER && c.rol === 'operario').id;
const recapadora = cuentas.find((c) => c.org === RECAP && c.rol === 'admin').id;
const derivada = await una(`select o.id, o.unidad_id from ordenes o where o.proveedor_id = $1 and o.estado = 'en_proveedor' limit 1`, [TALLER]);
await como(operario, `select taller_actualizar_orden($1, 'cerrada', 1450000, 880000, 'Tapa rectificada y probada en banco')`, [derivada.id]);
ok((await una('select estado::text e from ordenes where id = $1', [derivada.id])).e === 'cerrada', 'El taller externo cierra la orden que le derivaron, con sus costos');
const unidadTrasTaller = await una(`select u.estado::text e, (select count(*)::int from fallas f where f.orden_id = $2 and f.estado = 'en_reparacion') fallas from unidades u where u.id = $1`, [derivada.unidad_id, derivada.id]);
ok(unidadTrasTaller.e === 'operativa' && unidadTrasTaller.fallas === 0, 'Con la orden cerrada por el taller externo, la unidad vuelve a servicio y su falla queda resuelta');
const noDerivada = await una(`select id from ordenes where organizacion_id = $1 and proveedor_id is null limit 1`, [flotas[1].org]);
ok(/no encontrada/i.test((await error(operario, `select taller_actualizar_orden($1, 'cerrada', 1, 1, 'x')`, [noDerivada.id])) ?? ''), 'El taller no puede tocar órdenes que no le derivaron');
const enRecap = await una(`select count(*)::int n, min(id::text) id from neumaticos where proveedor_actual_id = $1`, [RECAP]);
await como(recapadora, 'select recapadora_recibir($1, 15, 245000)', [enRecap.id]);
ok((await una(`select count(*)::int n from neumaticos where proveedor_actual_id = $1`, [RECAP])).n === enRecap.n - 1, 'La recapadora devuelve una cubierta recapada a su flota');
const ajena = await una(`select id from neumaticos where organizacion_id = $1 and estado = 'montado' limit 1`, [flotas[2].org]);
ok(/no encontrado/i.test((await error(recapadora, 'select recapadora_recibir($1, 15, 1)', [ajena.id])) ?? ''), 'La recapadora no puede tocar cubiertas que no le mandaron');

console.log('Después de trabajar, todo sigue en regla');
control = await verificar();
const malas2 = control.filter((f) => f.resultado !== 'ok');
ok(malas2.length === 0, `${control.length} pruebas de nuevo, ${malas2.length} con problemas`);
for (const m of malas2) console.log('        ', m.empresa, m.cuenta, m.prueba, '→', m.detalle);

console.log('Borrado');
const borrar = leer('borrar_empresas_demo.sql');
await db.exec(borrar);
const restos = await una(`select
  (select count(*) from organizaciones where id::text like 'de000000-%') +
  (select count(*) from auth.users where id::text like 'de00a000-%') +
  (select count(*) from auth.identities where user_id::text like 'de00a000-%') +
  (select count(*) from miembros where organizacion_id::text like 'de000000-%') +
  (select count(*) from choferes where organizacion_id::text like 'de000000-%') +
  (select count(*) from unidades where organizacion_id::text like 'de000000-%') +
  (select count(*) from lecturas_km where organizacion_id::text like 'de000000-%') +
  (select count(*) from tareas_plan where organizacion_id::text like 'de000000-%') +
  (select count(*) from ordenes where organizacion_id::text like 'de000000-%') +
  (select count(*) from tipos_documento where organizacion_id::text like 'de000000-%') +
  (select count(*) from documentos where organizacion_id::text like 'de000000-%') +
  (select count(*) from neumaticos where organizacion_id::text like 'de000000-%') +
  (select count(*) from neumatico_eventos where organizacion_id::text like 'de000000-%') +
  (select count(*) from configuracion where organizacion_id::text like 'de000000-%') +
  (select count(*) from chequeos where organizacion_id::text like 'de000000-%') +
  (select count(*) from viajes where organizacion_id::text like 'de000000-%') +
  (select count(*) from fallas where organizacion_id::text like 'de000000-%') +
  (select count(*) from gastos where organizacion_id::text like 'de000000-%') +
  (select count(*) from invitaciones where organizacion_id::text like 'de000000-%') +
  (select count(*) from auditoria where organizacion_id::text like 'de000000-%') +
  (select count(*) from suscripciones where organizacion_id::text like 'de000000-%') +
  (select count(*) from pagos where organizacion_id::text like 'de000000-%') +
  (select count(*) from vinculos_proveedor where flota_id::text like 'de000000-%' or proveedor_id::text like 'de000000-%') n`);
ok(Number(restos.n) === 0, `No queda nada de las empresas de muestra en ninguna tabla (${restos.n})`);
ok((await fotoReal()) === realAntes, 'La empresa que no es de muestra quedó intacta');
await db.exec(borrar);
ok(true, 'Borrar dos veces no da error');

console.log('Se puede volver a cargar');
const resumen2 = (await db.exec(script)).at(-1).rows;
ok(JSON.stringify(resumen2) === JSON.stringify(resumen), 'Después de borrar, se vuelve a cargar igual (los mismos números)');
await db.exec(borrar);

console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
