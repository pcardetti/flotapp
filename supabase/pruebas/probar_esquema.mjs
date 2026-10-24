// Prueba el esquema en un Postgres local (PGlite): aislamiento entre empresas, roles, vínculos, neumáticos,
// viajes con chequeo, taller, gastos, fotos, invitaciones y tablero.
// Desde la raíz del repo: npm run test:db
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [modDir = join(process.cwd(), 'node_modules'), carpeta = join(process.cwd(), 'supabase', 'migrations')] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(join(modDir, '@electric-sql', 'pglite', 'dist', 'index.js')).href);
const db = new PGlite();

// Lo mínimo de Supabase que usan las migraciones: auth.uid() y el esquema de Storage.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
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
// Cada archivo en una transacción, como el SQL Editor de Supabase.
for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(carpeta, archivo), 'utf8'));
  console.log('Migración aplicada: ' + archivo);
}

const U = { A: 'aaaaaaaa-0000-0000-0000-000000000001', B: 'bbbbbbbb-0000-0000-0000-000000000002', C: 'cccccccc-0000-0000-0000-000000000003', T: 'dddddddd-0000-0000-0000-000000000004', R: 'eeeeeeee-0000-0000-0000-000000000005' };
for (const id of Object.values(U)) await db.query('insert into auth.users (id) values ($1)', [id]);

async function como(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[user]}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const uno = async (user, sql, p) => (await como(user, sql, p)).rows[0];
let fallas = 0;
function ok(cond, msg) { console.log((cond ? '  OK   ' : '  FALLA ') + msg); if (!cond) fallas++; }
async function debeFallar(user, sql, p, msg) {
  try { await como(user, sql, p); ok(false, msg + ' (no falló)'); } catch (e) { ok(true, msg + ' → ' + e.message.split('\n')[0]); }
}

const f1 = (await uno('A', `select crear_organizacion('Transporte Sur', 'flota') id`)).id;
const f2 = (await uno('B', `select crear_organizacion('Logística Norte', 'flota') id`)).id;
const tal = (await uno('T', `select crear_organizacion('Diesel Rosario', 'taller') id`)).id;
const rec = (await uno('R', `select crear_organizacion('Recapados del Litoral', 'recapadora') id`)).id;
ok((await uno('A', 'select count(*)::int n from tipos_documento')).n === 5, 'La flota nueva arranca con 5 tipos de documento');

const u1 = (await uno('A', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'AF 123 KD', 'tractor', 'Scania', 'R 450', 100000) returning id`, [f1])).id;
const u2 = (await uno('B', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'AB 999 ZZ', 'tractor', 'Iveco', 'Hi-Way', 50000) returning id`, [f2])).id;

console.log('Aislamiento entre flotas');
ok((await uno('A', 'select count(*)::int n from unidades')).n === 1, 'A ve sólo su unidad');
ok((await uno('B', 'select count(*)::int n from unidades')).n === 1, 'B ve sólo su unidad');
ok((await uno('B', 'select count(*)::int n from organizaciones')).n === 1, 'B no ve otras empresas');
await debeFallar('A', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'X', 'tractor', 'X', 'X')`, [f2], 'A no puede cargar unidades en la flota de B');
ok((await como('A', `update unidades set km = 1 where id = $1`, [u2])).affectedRows === 0, 'A no puede editar la unidad de B');
const td2 = (await uno('B', 'select id from tipos_documento limit 1')).id;
await debeFallar('B', `insert into documentos (organizacion_id, tipo_documento_id, unidad_id, vence) values ($1, $2, $3, current_date)`, [f2, td2, u1], 'B no puede colgar un documento de una unidad de A (clave compuesta)');

console.log('Roles dentro de la flota');
await como('A', `insert into miembros (organizacion_id, user_id, rol) values ($1, $2, 'chofer')`, [f1, U.C]);
await debeFallar('A', `insert into miembros (organizacion_id, user_id, rol) values ($1, $2, 'operario')`, [f1, U.B], 'Una flota no acepta el rol operario');
await como('C', `insert into lecturas_km (organizacion_id, unidad_id, km) values ($1, $2, 105000)`, [f1, u1]);
ok((await uno('A', 'select km from unidades where id = $1', [u1])).km === 105000, 'La lectura del chofer actualiza el km de la unidad');
ok((await como('C', `update unidades set km = 1 where id = $1`, [u1])).affectedRows === 0, 'El chofer no puede editar unidades');
await debeFallar('C', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion) values ($1, $2, 'correctivo', 'x')`, [f1, u1], 'El chofer no puede abrir órdenes');

console.log('Órdenes y numeración');
await como('A', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion) values ($1, $2, 'preventivo', 'Service')`, [f1, u1]);
await como('A', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion) values ($1, $2, 'correctivo', 'Frenos')`, [f1, u1]);
await como('B', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion) values ($1, $2, 'correctivo', 'Embrague')`, [f2, u2]);
ok((await uno('A', 'select max(numero) n from ordenes')).n === 2 && (await uno('B', 'select max(numero) n from ordenes')).n === 1, 'Cada flota numera sus órdenes desde 1');

console.log('Taller vinculado');
await como('A', `insert into vinculos_proveedor (flota_id, proveedor_id) values ($1, $2)`, [f1, tal]);
await debeFallar('A', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion, proveedor_id) values ($1, $2, 'correctivo', 'Inyector', $3)`, [f1, u1, tal], 'No se deriva una orden a un taller con vínculo pendiente');
ok((await uno('T', 'select count(*)::int n from unidades')).n === 0, 'Con vínculo pendiente el taller no ve unidades');
ok((await uno('T', `select nombre from organizaciones where id = $1`, [f1]))?.nombre === 'Transporte Sur', 'El taller ve el nombre de la flota que lo invitó');
await debeFallar('A', `update vinculos_proveedor set estado = 'activo' where flota_id = $1`, [f1], 'La flota no puede aceptar el vínculo en nombre del taller');
await como('T', `update vinculos_proveedor set estado = 'activo' where flota_id = $1`, [f1]);
await debeFallar('T', `update vinculos_proveedor set flota_id = $2 where flota_id = $1`, [f1, f2], 'El taller no puede redirigir su vínculo hacia otra flota');
await debeFallar('T', `insert into vinculos_proveedor (flota_id, proveedor_id, estado) values ($1, $2, 'pendiente')`, [f2, tal], 'El taller no puede auto-invitarse a otra flota');
const ot = (await uno('A', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion, proveedor_id, estado) values ($1, $2, 'correctivo', 'Inyector', $3, 'en_proveedor') returning id`, [f1, u1, tal])).id;
ok((await uno('T', 'select count(*)::int n from ordenes')).n === 1, 'El taller ve sólo la orden derivada a él');
ok((await uno('T', 'select count(*)::int n from unidades')).n === 1, 'El taller ve las unidades de la flota vinculada');
ok((await uno('T', 'select count(*)::int n from tareas_plan')).n === 0 && (await uno('T', 'select count(*)::int n from documentos')).n === 0, 'El taller no ve planes ni documentos');
ok((await como('T', `update ordenes set repuestos = 1 where id = $1`, [ot])).affectedRows === 0, 'El taller no edita la orden directamente');
await como('T', `select taller_actualizar_orden($1, 'cerrada', 850000, 150000, 'Inyector reemplazado')`, [ot]);
const o = await uno('A', 'select estado, repuestos::int r, fecha_egreso from ordenes where id = $1', [ot]);
ok(o.estado === 'cerrada' && o.r === 850000 && o.fecha_egreso, 'El taller informa costos y cierra su orden');
await debeFallar('B', `select taller_actualizar_orden($1, 'cerrada', 1, 1, 'x')`, [ot], 'Otra flota no puede tocar esa orden');

console.log('Neumáticos con historial');
const n1 = (await uno('A', `select neumatico_alta($1, 'n-0001', 'Fate', '295/80 R22.5', 16, 0, 1150000) id`, [f1])).id;
const n2 = (await uno('A', `select neumatico_alta($1, 'N-0002', 'Pirelli', '295/80 R22.5', 16, 0, 1100000) id`, [f1])).id;
await debeFallar('A', `select neumatico_alta($1, 'N-0001', 'X', 'X', 10)`, [f1], 'No se repite el código dentro de la flota');
ok(!!(await uno('B', `select neumatico_alta($1, 'N-0001', 'Fate', '295/80 R22.5', 16) id`, [f2])).id, 'Otra flota puede usar el mismo código');
await como('A', `select neumatico_montar($1, $2, 'E1-I')`, [n1, u1]);
await como('A', `select neumatico_montar($1, $2, 'E1-D')`, [n2, u1]);
await debeFallar('A', `select neumatico_montar($1, $2, 'E1-D')`, [n1, u1], 'No se monta un neumático que ya está montado');
await como('C', `insert into lecturas_km (organizacion_id, unidad_id, km) values ($1, $2, 110000)`, [f1, u1]);
await como('A', `select neumatico_mover($1, $2, 'E1-D')`, [n1, u1]);
const p = (await como('A', `select codigo, posicion, km_total from neumaticos where organizacion_id = $1 order by codigo`, [f1])).rows;
ok(p[0].posicion === 'E1-D' && p[1].posicion === 'E1-I' && p[0].km_total === 5000 && p[1].km_total === 5000, 'Rotación con intercambio y km acumulados (5.000 km cada uno)');
await debeFallar('A', `select neumatico_sacar($1, 'recapado', $2)`, [n1, rec], 'No se envía a una recapadora sin vínculo activo');
await como('A', `insert into vinculos_proveedor (flota_id, proveedor_id) values ($1, $2)`, [f1, rec]);
await como('R', `update vinculos_proveedor set estado = 'activo' where flota_id = $1`, [f1]);
await como('C', `insert into lecturas_km (organizacion_id, unidad_id, km) values ($1, $2, 112000)`, [f1, u1]);
await como('A', `select neumatico_sacar($1, 'recapado', $2, 'Desgaste parejo', 3.2)`, [n1, rec]);
ok((await uno('R', 'select count(*)::int n from neumaticos')).n === 1, 'La recapadora ve sólo el neumático que le enviaron');
ok((await uno('R', 'select count(*)::int n from neumatico_eventos')).n >= 4, 'La recapadora ve el historial de ese neumático');
await como('R', `select recapadora_recibir($1, 15.5, 340000)`, [n1]);
const r1 = await uno('A', 'select estado, recapados, km_total, km_vida, costo_total::int c from neumaticos where id = $1', [n1]);
ok(r1.estado === 'deposito' && r1.recapados === 1 && r1.km_total === 7000 && r1.km_vida === 0 && r1.c === 1490000, 'Vuelve al depósito: vida 2, 7.000 km totales, costo acumulado');
ok((await uno('R', 'select count(*)::int n from neumaticos')).n === 0, 'Al devolverlo, la recapadora deja de verlo');
const tipos = (await como('A', 'select tipo from neumatico_eventos where neumatico_id = $1 order by creado_en, id', [n1])).rows.map(r => r.tipo);
ok(['alta', 'montaje', 'rotacion', 'envio', 'recapado'].every(t => tipos.includes(t)), 'Historial completo: ' + tipos.join(', '));
ok((await como('A', `update neumatico_eventos set detalle = 'x' where neumatico_id = $1`, [n1])).affectedRows === 0, 'El historial no se puede editar');
ok((await como('A', `delete from neumatico_eventos where neumatico_id = $1`, [n1])).affectedRows === 0, 'El historial no se puede borrar');
ok((await uno('B', 'select count(*)::int n from neumatico_eventos')).n === 1, 'B sólo ve el historial de su propio neumático');

// Las mismas operaciones que hacen las pantallas de Flota y choferes, con los códigos de error que la app traduce.
console.log('Carga de unidades y choferes');
async function esperarError(user, sql, p, codigo, patron, msg) {
  try { await como(user, sql, p); ok(false, msg + ' (no falló)'); } catch (e) { ok(e.code === codigo && patron.test(e.message), `${msg} → ${e.code} ${e.message.split('\n')[0]}`); }
}
U.J = 'ffffffff-0000-0000-0000-000000000006';
U.L = '99999999-0000-0000-0000-000000000007';
for (const id of [U.J, U.L]) await db.query('insert into auth.users (id) values ($1)', [id]);
await como('A', `insert into miembros (organizacion_id, user_id, rol) values ($1, $2, 'jefe_taller'), ($1, $3, 'lectura')`, [f1, U.J, U.L]);
const ch1 = (await uno('J', `insert into choferes (organizacion_id, nombre) values ($1, 'Ana Paz') returning id`, [f1])).id;
const chB = (await uno('B', `insert into choferes (organizacion_id, nombre) values ($1, 'Otro chofer') returning id`, [f2])).id;
const insUnidad = `insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km, chofer_id) values ($1, $2, 'tractor', 'Iveco', 'Hi-Way', $3, $4) returning id`;
const u3 = (await uno('J', insUnidad, [f1, 'AE 902 BX', 518400, ch1])).id;
ok(!!u3, 'El jefe de taller carga una unidad con un chofer de su flota');
await esperarError('J', insUnidad, [f1, 'AA 111 AA', 1000, chB], '23503', /chofer/, 'No se asigna un chofer de otra flota');
await esperarError('J', insUnidad, [f1, 'AE 902 BX', 1, null], '23505', /dominio/, 'No se repite la patente en la misma flota');
ok(!!(await uno('B', insUnidad, [f2, 'AE 902 BX', 1, null])).id, 'Otra flota puede tener una unidad con la misma patente');
await esperarError('L', insUnidad, [f1, 'AB 222 CD', 1, null], '42501', /row-level security/, 'El rol consulta no puede cargar unidades');

await como('J', `insert into lecturas_km (organizacion_id, unidad_id, km, origen) values ($1, $2, 520000, 'manual')`, [f1, u3]);
ok((await uno('L', 'select km from unidades where id = $1', [u3])).km === 520000, 'Una lectura mayor actualiza el km (y el rol consulta la ve)');
ok((await como('J', 'update unidades set km = 519000 where id = $1', [u3])).affectedRows === 1, 'El jefe de taller corrige el km desde Editar');
await como('J', `insert into lecturas_km (organizacion_id, unidad_id, km, origen) values ($1, $2, 519000, 'correccion')`, [f1, u3]);
ok((await uno('A', 'select km from unidades where id = $1', [u3])).km === 519000, 'La corrección hacia abajo queda en 519.000 km');
ok((await uno('A', 'select count(*)::int n from lecturas_km where unidad_id = $1', [u3])).n === 2, 'Las lecturas quedan en el historial');

await como('A', `insert into ordenes (organizacion_id, unidad_id, tipo, descripcion) values ($1, $2, 'correctivo', 'Frenos')`, [f1, u3]);
await esperarError('A', 'delete from unidades where id = $1', [u3], '23503', /ordenes/, 'No se elimina una unidad con órdenes de trabajo');
const u4 = (await uno('J', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'AC 774 SN', 'semirremolque', 'Helvética', 'Sider') returning id, km`, [f1]));
ok(u4.km === null, 'Un semirremolque se carga sin kilometraje');
ok((await como('J', 'delete from unidades where id = $1', [u4.id])).affectedRows === 0, 'El jefe de taller no puede eliminar unidades');
ok((await como('A', 'delete from unidades where id = $1', [u4.id])).affectedRows === 1, 'El administrador elimina una unidad sin historia');

const tipoLic = (await uno('A', `select id from tipos_documento where organizacion_id = $1 and aplica = 'chofer' limit 1`, [f1])).id;
await como('J', `insert into documentos (organizacion_id, tipo_documento_id, chofer_id, vence) values ($1, $2, $3, current_date + 300)`, [f1, tipoLic, ch1]);
ok((await como('J', 'delete from choferes where id = $1', [ch1])).affectedRows === 1, 'El jefe de taller elimina un chofer');
ok((await uno('A', 'select chofer_id from unidades where id = $1', [u3])).chofer_id === null, 'Su unidad queda sin chofer asignado');
ok((await uno('A', 'select count(*)::int n from documentos where chofer_id = $1', [ch1])).n === 0, 'Sus documentos se borran con él');

// ───────────── 0002: QR, invitaciones, viajes, taller, gastos, fotos y tablero ─────────────
console.log('QR por unidad');
const qr = (await uno('A', 'select qr_token from unidades where id = $1', [u3])).qr_token;
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(qr), 'Cada unidad tiene un código QR de 8 caracteres sin 0/O ni 1/I');
ok((await uno('A', 'select count(distinct qr_token) = count(*) iguales from unidades')).iguales, 'Los códigos no se repiten');

console.log('Invitaciones');
U.D = '12121212-0000-0000-0000-000000000008'; // chofer invitado
U.E = '34343434-0000-0000-0000-000000000009'; // otra persona con el mismo enlace
U.M = '56565656-0000-0000-0000-00000000000a'; // mecánico
for (const id of [U.D, U.E, U.M]) await db.query('insert into auth.users (id) values ($1)', [id]);
const chD = (await uno('A', `insert into choferes (organizacion_id, nombre) values ($1, 'Darío Ledesma') returning id`, [f1])).id;
const inv = (await uno('A', `insert into invitaciones (organizacion_id, rol, chofer_id, nombre) values ($1, 'chofer', $2, 'Darío') returning token`, [f1, chD])).token;
await debeFallar('J', `insert into invitaciones (organizacion_id, rol) values ($1, 'chofer')`, [f1], 'Sólo el administrador crea invitaciones');
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
const vistaAnonima = (await db.query('select ver_invitacion($1) v', [inv])).rows[0].v;
await db.exec('reset role');
ok(vistaAnonima?.empresa === 'Transporte Sur', 'Sin iniciar sesión, el enlace muestra a qué empresa te invitan');
await db.exec(`reset role; set role anon;`);
let anonVeTablas = true;
try { await db.query('select count(*) from invitaciones'); } catch { anonVeTablas = false; }
await db.exec('reset role');
ok(!anonVeTablas, 'Pero sin sesión no se puede leer ninguna tabla');
const vista = (await uno('D', 'select ver_invitacion($1) v', [inv])).v;
ok(vista?.empresa === 'Transporte Sur' && vista.rol === 'chofer' && vista.estado === 'vigente', 'El invitado ve empresa, rol y que la invitación está vigente');
const acepta = (await uno('D', 'select aceptar_invitacion($1) r', [inv])).r;
ok(acepta.rol === 'chofer', 'Al aceptar queda como chofer de la flota');
const miembroD = await uno('D', 'select chofer_id, nombre from miembros where organizacion_id = $1 and user_id = $2', [f1, U.D]);
ok(miembroD.chofer_id === chD && miembroD.nombre === 'Darío', 'Su cuenta queda vinculada al chofer que eligió el administrador, con su nombre');
await debeFallar('E', 'select aceptar_invitacion($1)', [inv], 'Un enlace usado no sirve para otra persona');
const invAdmin = (await uno('A', `insert into invitaciones (organizacion_id, rol) values ($1, 'chofer') returning token`, [f1])).token;
ok((await uno('A', 'select aceptar_invitacion($1) r', [invAdmin])).r.rol === 'admin', 'Un administrador que abre un enlace de chofer conserva su rol');
const invVieja = (await uno('A', `insert into invitaciones (organizacion_id, rol, vence) values ($1, 'chofer', now() - interval '1 day') returning token`, [f1])).token;
await debeFallar('E', 'select aceptar_invitacion($1)', [invVieja], 'Una invitación vencida no se puede usar');
const invMec = (await uno('A', `insert into invitaciones (organizacion_id, rol) values ($1, 'mecanico') returning token`, [f1])).token;
ok((await uno('M', 'select aceptar_invitacion($1) r', [invMec])).r.rol === 'mecanico', 'El mecánico se suma con su invitación');

console.log('Viaje con chequeo previo (QR)');
const ficha = (await uno('D', 'select ficha_qr($1) f', [qr.toLowerCase()])).f;
ok(ficha?.unidad?.dominio === 'AE 902 BX' && ficha.mi_rol === 'chofer', 'El chofer escanea el QR y ve la unidad de su flota');
const claves = ficha.items.map((i) => i.clave);
ok(claves.includes('enganche') && claves.includes('tacografo') && claves.length === 11, 'Un tractor pide los 11 puntos, incluidos enganche y tacógrafo');
ok((await uno('B', 'select ficha_qr($1) f', [qr])).f === null, 'Alguien de otra flota no ve nada con ese QR');
const todoBien = Object.fromEntries(claves.map((c) => [c, { estado: 'ok' }]));
const qrSemi = (await uno('A', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo) values ($1, 'AD 310 QS', 'semirremolque', 'Helvética', 'Sider') returning qr_token`, [f1])).qr_token;
await debeFallar('D', 'select iniciar_viaje($1, 0, 75::smallint, $2)', [qrSemi, JSON.stringify(todoBien)], 'Con el QR de un semirremolque no se empieza un viaje');
await debeFallar('D', 'select iniciar_viaje($1, 520000, 75::smallint, $2)', [qr, JSON.stringify({ neumaticos: { estado: 'ok' } })], 'No se sale sin completar el chequeo');
await debeFallar('D', 'select iniciar_viaje($1, 100, 75::smallint, $2)', [qr, JSON.stringify(todoBien)], 'No se sale con un kilometraje menor al último');
const conObs = { ...todoBien, visibilidad: { estado: 'problema', nota: 'Espejo derecho flojo', fotos: [`${f1}/fallas/espejo.jpg`] } };
const inicio = (await uno('D', 'select iniciar_viaje($1, 520500, 75::smallint, $2, $3) r', [qr, JSON.stringify(conObs), 'Rosario'])).r;
ok(inicio.estado === 'iniciado', 'Con todo revisado y un problema menor, el viaje empieza');
const fallaEspejo = await uno('M', `select gravedad, fotos, descripcion from fallas where unidad_id = $1 and sistema = 'visibilidad'`, [u3]);
ok(fallaEspejo?.gravedad === 'moderada' && fallaEspejo.fotos.length === 1 && fallaEspejo.descripcion === 'Espejo derecho flojo', 'El problema menor queda como falla con su foto para el taller');
await debeFallar('D', 'select iniciar_viaje($1, 520500, 75::smallint, $2)', [qr, JSON.stringify(todoBien)], 'No se puede empezar un segundo viaje');
await debeFallar('A', 'select iniciar_viaje($1, 520500, 75::smallint, $2)', [qr, JSON.stringify(todoBien)], 'Otra persona no puede salir con una unidad que ya está en viaje');
ok((await uno('D', 'select count(*)::int n from viajes')).n === 1 && (await uno('C', 'select count(*)::int n from viajes')).n === 0, 'Cada chofer ve sólo sus viajes');
ok((await uno('M', 'select count(*)::int n from viajes')).n === 1, 'El mecánico ve los viajes de la flota');
await debeFallar('D', 'select terminar_viaje($1, 500000, 50::smallint)', [inicio.viaje_id], 'No se termina con menos km que al salir');
await como('D', 'select terminar_viaje($1, 521300, 40::smallint)', [inicio.viaje_id]);
const fin = await uno('A', 'select v.estado, v.km_fin, u.km from viajes v join unidades u on u.id = v.unidad_id where v.id = $1', [inicio.viaje_id]);
ok(fin.estado === 'terminado' && fin.km_fin === 521300 && fin.km === 521300, 'Al terminar se registran los km y la unidad queda actualizada');

console.log('Falla crítica');
const critico = { ...todoBien, frenos: { estado: 'problema', nota: 'Pierde aire', fotos: [`${f1}/fallas/aire.jpg`] } };
const bloqueo = (await uno('D', 'select iniciar_viaje($1, 521300, 40::smallint, $2) r', [qr, JSON.stringify(critico)])).r;
ok(bloqueo.estado === 'bloqueado' && bloqueo.fallas_criticas === 1, 'Con una falla crítica el viaje no empieza');
ok((await uno('A', 'select estado from unidades where id = $1', [u3])).estado === 'taller', 'La unidad pasa sola a "En taller"');
await debeFallar('D', 'select iniciar_viaje($1, 521300, 40::smallint, $2)', [qr, JSON.stringify(todoBien)], 'Nadie sale con la unidad hasta que el taller la libere');
await debeFallar('D', 'select liberar_unidad_si_corresponde($1)', [u3], 'Un chofer no puede liberar la unidad por su cuenta');
const fallaFrenos = (await uno('M', `select id from fallas where unidad_id = $1 and sistema = 'frenos' and estado = 'abierta'`, [u3])).id;
await debeFallar('D', `select registrar_trabajo($1, 'correctivo', 'Frenos', 'x')`, [u3], 'El chofer no registra trabajos de taller');
const otFrenos = (await uno('M', `select registrar_trabajo($1, 'correctivo', 'Frenos: pérdida de aire', 'Cambio de pulmón trasero', $2, 85000, 30000, null, $3) id`, [u3, [`${f1}/ordenes/pulmon.jpg`], [fallaFrenos]])).id;
const otFila = await uno('A', 'select estado, numero, fotos, repuestos::int r from ordenes where id = $1', [otFrenos]);
ok(otFila.estado === 'cerrada' && otFila.numero > 0 && otFila.fotos.length === 1 && otFila.r === 85000, 'El mecánico resuelve en un paso: orden cerrada con número, foto y costos');
ok((await uno('A', 'select estado from fallas where id = $1', [fallaFrenos])).estado === 'resuelta', 'La falla queda resuelta y vinculada a la orden');
ok((await uno('A', 'select estado from unidades where id = $1', [u3])).estado === 'operativa', 'La unidad vuelve sola a "En servicio"');
const otLarga = (await uno('M', `select abrir_orden($1, 'Cambio de embrague') id`, [u3])).id;
ok((await uno('A', 'select estado from unidades where id = $1', [u3])).estado === 'taller', 'Una orden larga deja la unidad en el taller');
await como('M', `select cerrar_orden($1, 'Embrague nuevo', $2, 400000, 120000, 521350)`, [otLarga, [`${f1}/ordenes/embrague.jpg`]]);
ok((await uno('A', 'select estado from unidades where id = $1', [u3])).estado === 'operativa', 'Al cerrarla, la unidad vuelve a servicio');
ok((await como('M', 'update unidades set km = 1 where id = $1', [u3])).affectedRows === 0, 'El mecánico no edita unidades directamente');
const errorDeCarga = { ...todoBien, luces: { estado: 'problema', nota: 'Me equivoqué' } };
await uno('D', 'select iniciar_viaje($1, 521400, 40::smallint, $2) r', [qr, JSON.stringify(errorDeCarga)]);
const fallaLuces = (await uno('M', `select id from fallas where unidad_id = $1 and sistema = 'luces' and estado = 'abierta'`, [u3])).id;
await debeFallar('D', 'select descartar_falla($1)', [fallaLuces], 'El chofer no puede descartar fallas');
await como('M', 'select descartar_falla($1)', [fallaLuces]);
ok((await uno('A', 'select estado from unidades where id = $1', [u3])).estado === 'operativa', 'Al descartar una falla crítica cargada por error, la unidad vuelve a servicio');

console.log('Gastos y fotos');
await como('D', `insert into gastos (organizacion_id, categoria, monto, litros, unidad_id, chofer_id, viaje_id) values ($1, 'combustible', 180000, 150, $2, $3, $4)`, [f1, u3, chD, inicio.viaje_id]);
const chOtro = (await uno('A', `insert into choferes (organizacion_id, nombre) values ($1, 'Otro chofer') returning id`, [f1])).id;
await debeFallar('D', `insert into gastos (organizacion_id, categoria, monto, chofer_id) values ($1, 'peaje', 5000, $2)`, [f1, chOtro], 'El chofer no carga gastos a nombre de otro');
await como('A', `insert into gastos (organizacion_id, categoria, monto) values ($1, 'seguro', 250000)`, [f1]);
ok((await uno('D', 'select count(*)::int n from gastos')).n === 1, 'El chofer ve sólo sus gastos');
ok((await uno('L', 'select count(*)::int n from gastos')).n === 2, 'La gerencia ve todos los gastos');
ok((await uno('M', 'select count(*)::int n from gastos')).n === 0, 'El mecánico no ve gastos');
await como('D', `insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${f1}/fallas/rueda.jpg`]);
await debeFallar('D', `insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${f2}/fallas/rueda.jpg`], 'Nadie sube fotos a la carpeta de otra flota');
await debeFallar('L', `insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${f1}/fallas/x.jpg`], 'El rol consulta no sube fotos');
ok((await uno('B', 'select count(*)::int n from storage.objects')).n === 0 && (await uno('M', 'select count(*)::int n from storage.objects')).n === 1, 'Las fotos sólo las ve la flota dueña');

console.log('Tablero');
const t = (await uno('A', `select tablero($1, current_date - 30, current_date) t`, [f1])).t;
// Mantenimiento: 115.000 + 520.000 de este bloque, más el 1.000.000 que cerró el taller externo más arriba.
const mantenimiento = 85000 + 30000 + 400000 + 120000 + 1000000;
ok(Number(t.totales.costo) === 180000 + 250000 + mantenimiento, 'Costo total = combustible + seguro + mantenimiento (' + t.totales.costo + ')');
ok(Number(t.totales.mantenimiento) === mantenimiento && Number(t.totales.litros) === 150 && t.totales.viajes === 1, 'Mantenimiento, litros y viajes del período');
const fu = t.por_unidad.find((x) => x.dominio === 'AE 902 BX');
ok(fu && Number(fu.km) > 0 && Number(fu.litros) === 150 && fu.viajes === 1, 'Por unidad: km, litros y viajes (' + JSON.stringify({ km: fu?.km, litros: fu?.litros }) + ')');
const fc = t.por_chofer.find((x) => x.nombre === 'Darío Ledesma');
// Fallas reportadas por Darío: espejo, frenos y la de luces que después se descartó.
ok(fc && fc.viajes === 1 && Number(fc.km) === 800 && Number(fc.gastos) === 180000 && fc.fallas === 3, 'Por chofer: viajes, km, gastos y fallas reportadas');
ok(t.por_mes.length === 12 && t.por_categoria.length === 3, 'Serie de 12 meses y 3 categorías de costo');
ok(t.fallas_por_sistema.some((x) => x.sistema === 'frenos'), 'Fallas agrupadas por sistema');
ok(typeof t.ahora.en_servicio === 'number' && t.ahora.en_viaje === 0, 'Estado actual de la flota');
ok(!!(await uno('L', `select tablero($1, current_date - 30, current_date) t`, [f1])).t, 'El rol consulta ve el tablero');
await debeFallar('D', `select tablero($1, current_date - 30, current_date)`, [f1], 'El chofer no ve el tablero');
await debeFallar('M', `select tablero($1, current_date - 30, current_date)`, [f1], 'El mecánico no ve el tablero');

console.log('Límite de intentos');
const comoAnonimo = async (sql, p) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  try { return await db.query(sql, p); } finally { await db.exec('reset role'); }
};
const claveMail = 'a'.repeat(64);
const intentos = [];
for (let i = 0; i < 11; i++) intentos.push((await comoAnonimo(`select consumir_intento('ingresar_mail', $1) r`, [claveMail])).rows[0].r);
ok(intentos.slice(0, 10).every(Boolean) && intentos[10] === false, 'Sin sesión se cuentan los intentos: el 11º ingreso con el mismo mail se frena');
ok((await comoAnonimo(`select consumir_intento('ingresar_mail', $1) r`, ['b'.repeat(64)])).rows[0].r === true, 'Cada mail tiene su propio contador');
let anonLeeLimites = true;
try { await comoAnonimo('select count(*) from limites_acceso'); } catch { anonLeeLimites = false; }
ok(!anonLeeLimites, 'Nadie lee los contadores directo');
let accionDesconocida = false;
try { await comoAnonimo(`select consumir_intento('reiniciar', $1)`, [claveMail]); } catch { accionDesconocida = true; }
ok(accionDesconocida, 'Sólo hay acciones conocidas, con tope y ventana fijos en la base');
await db.query(`update limites_acceso set desde = now() - interval '16 minutes' where clave = $1`, [claveMail]);
ok((await comoAnonimo(`select consumir_intento('ingresar_mail', $1) r`, [claveMail])).rows[0].r === true, 'Pasados 15 minutos se puede volver a intentar');

console.log('Auditoría');
await db.query(`select set_config('request.headers', $1, false)`, [JSON.stringify({ 'x-flotapp-ip': '190.1.2.3', 'x-flotapp-agente': 'Prueba/1.0' })]);
await db.query(`update auth.users set email = 'admin@flota.test' where id = $1`, [U.A]);
await como('A', `update miembros set rol = 'mecanico' where organizacion_id = $1 and user_id = $2`, [f1, U.L]);
const cambio = await uno('A', `select * from auditoria where organizacion_id = $1 and accion = 'miembro.rol' order by id desc limit 1`, [f1]);
ok(cambio?.user_id === U.A && cambio.rol === 'admin' && cambio.detalle.de === 'lectura' && cambio.detalle.a === 'mecanico'
  && cambio.ip === '190.1.2.3' && cambio.agente === 'Prueba/1.0' && cambio.categoria === 'equipo',
  'Un cambio de rol queda anotado: quién, con qué rol, de qué a qué, IP y navegador');
ok(cambio?.quien === 'admin@flota.test', 'Sin nombre cargado, figura el mail de quien lo hizo');
await como('A', `update miembros set rol = 'lectura' where organizacion_id = $1 and user_id = $2`, [f1, U.L]);
const invAud = await uno('A', `insert into invitaciones (organizacion_id, rol, nombre) values ($1, 'chofer', 'Hugo Paz') returning id, token`, [f1]);
await como('A', `update invitaciones set revocada = true where id = $1`, [invAud.id]);
const evInv = (await como('A', `select accion, detalle from auditoria where recurso = 'invitaciones' and recurso_id = $1 order by id`, [invAud.id])).rows;
ok(evInv.map((e) => e.accion).join() === 'invitacion.creada,invitacion.cancelada' && !JSON.stringify(evInv).includes(invAud.token),
  'Invitaciones creadas y canceladas, sin guardar el token');
const gastoAud = (await uno('A', `insert into gastos (organizacion_id, categoria, monto) values ($1, 'multa', 98000) returning id`, [f1])).id;
await como('A', 'delete from gastos where id = $1', [gastoAud]);
const evGasto = await uno('A', `select detalle from auditoria where accion = 'gasto.borrado' and recurso_id = $1`, [gastoAud]);
ok(Number(evGasto?.detalle.monto) === 98000 && evGasto.detalle.categoria === 'multa', 'Un gasto borrado queda anotado con su monto');
const tiposEvento = (await como('A', `select distinct accion from auditoria where organizacion_id = $1`, [f1])).rows.map((r) => r.accion);
ok(['miembro.alta', 'unidad.borrada', 'orden.cerrada', 'falla.descartada'].every((a) => tiposEvento.includes(a)),
  'También quedan las altas del equipo, unidades borradas, órdenes cerradas y fallas descartadas');
ok((await uno('L', 'select count(*)::int n from auditoria')).n === 0, 'El rol consulta no ve la actividad');
ok((await uno('D', 'select count(*)::int n from auditoria')).n === 0, 'El chofer no ve la actividad');
ok((await uno('B', 'select count(*)::int n from auditoria where organizacion_id = $1', [f1])).n === 0, 'Otra empresa no ve la actividad');
await debeFallar('A', `insert into auditoria (organizacion_id, accion, categoria, recurso) values ($1, 'falso', 'equipo', 'x')`, [f1], 'Nadie escribe la auditoría a mano');
await debeFallar('A', `update auditoria set quien = 'otro' where organizacion_id = $1`, [f1], 'Nadie la edita');
await debeFallar('A', `delete from auditoria where organizacion_id = $1`, [f1], 'Nadie la borra');
await como('D', `select auditar_denegado($1, 'equipo')`, [f1]);
await como('D', `select auditar_denegado($1, 'equipo')`, [f1]);
await como('B', `select auditar_denegado($1, 'equipo')`, [f1]);
const denegados = (await como('A', `select user_id from auditoria where organizacion_id = $1 and accion = 'permiso.denegado'`, [f1])).rows;
ok(denegados.length === 1 && denegados[0].user_id === U.D, 'Un intento sin permiso se anota una vez por minuto, y sólo de quien es miembro');
await db.query(`update auth.users set last_sign_in_at = now() - interval '2 hours' where id = $1`, [U.D]);
ok((await como('A', 'select * from ultimos_ingresos($1)', [f1])).rows.some((r) => r.user_id === U.D && r.ultimo_ingreso), 'El administrador ve el último ingreso de cada integrante');
ok((await como('L', 'select * from ultimos_ingresos($1)', [f1])).rows.length === 0, 'Los demás roles no');
await db.query(`select set_config('request.headers', '', false)`);

console.log('Al menos un administrador');
await debeFallar('A', `update miembros set rol = 'jefe_taller' where organizacion_id = $1 and user_id = $2`, [f1, U.A], 'El único administrador no puede dejar el rol');
await debeFallar('A', `delete from miembros where organizacion_id = $1 and user_id = $2`, [f1, U.A], 'Ni quitarse de la empresa');
await como('A', `update miembros set rol = 'admin' where organizacion_id = $1 and user_id = $2`, [f1, U.J]);
await como('A', `update miembros set rol = 'jefe_taller' where organizacion_id = $1 and user_id = $2`, [f1, U.A]);
ok((await uno('J', `select rol from miembros where organizacion_id = $1 and user_id = $2`, [f1, U.A])).rol === 'jefe_taller', 'Con otra persona como administradora, sí puede dejar el rol');
U.Y = '78787878-0000-0000-0000-00000000000b';
U.Z = '90909090-0000-0000-0000-00000000000c';
for (const id of [U.Y, U.Z]) await db.query('insert into auth.users (id) values ($1)', [id]);
const orgY = (await uno('Y', `select crear_organizacion('Flota Y', 'flota') id`)).id;
await uno('Z', `select crear_organizacion('Flota Z', 'flota') id`);
await db.query('delete from organizaciones where id = $1', [orgY]);
ok((await db.query('select count(*)::int n from miembros where organizacion_id = $1', [orgY])).rows[0].n === 0, 'Borrar una empresa entera no queda trabado por esta regla');
await db.query('delete from auth.users where id = $1', [U.Z]);
ok((await db.query('select count(*)::int n from miembros where user_id = $1', [U.Z])).rows[0].n === 0, 'Ni borrar la cuenta de un administrador');

console.log('Permisos de la app = permisos de la base');
// La tabla de permisos de la app (src/lib/permisos.ts) contra lo que de verdad deja la base, rol por rol.
const { GRUPOS, PERMISOS, ROLES, ROLES_DE, TIPOS, puede } = await import(pathToFileURL(join(process.cwd(), 'src', 'lib', 'permisos.ts')).href);
const detalle = (lista) => (lista.length ? ` → ${lista.join('; ')}` : '');
const rolesBase = (await db.query('select unnest(enum_range(null::rol_miembro))::text rol')).rows.map((f) => f.rol);
ok([...rolesBase].sort().join() === [...ROLES].sort().join(), 'La app y la base tienen los mismos roles');

U.X = '5a5a5a5a-0000-0000-0000-00000000000d';
U.P = '6b6b6b6b-0000-0000-0000-00000000000e';
U.Q = '7c7c7c7c-0000-0000-0000-00000000000f';
for (const id of [U.X, U.P, U.Q]) await db.query('insert into auth.users (id) values ($1)', [id]);

// Qué roles acepta la base en cada tipo de empresa (se prueba en una transacción que después se deshace).
async function aceptaRol(org, rol) {
  await db.exec('begin');
  try {
    await db.query('insert into miembros (organizacion_id, user_id, rol) values ($1, $2, $3)', [org, U.Q, rol]);
    return true;
  } catch {
    return false;
  } finally {
    await db.exec('rollback');
  }
}
const empresaDe = { flota: f1, taller: tal, recapadora: rec };
const rolesDistintos = [];
for (const tipo of TIPOS) {
  for (const rol of ROLES) if ((await aceptaRol(empresaDe[tipo], rol)) !== ROLES_DE[tipo].includes(rol)) rolesDistintos.push(`${rol} en ${tipo}`);
}
ok(rolesDistintos.length === 0, 'Cada tipo de empresa acepta en la base los mismos roles que ofrece la app' + detalle(rolesDistintos));

const fp = (await uno('X', `select crear_organizacion('Flota Permisos', 'flota') id`)).id;
const { id: uSonda, qr_token: qrSonda } = (await db.query(`insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'PRB 001', 'tractor', 'Scania', 'R 450', 1000) returning id, qr_token`, [fp])).rows[0];
const uBorrar = (await db.query(`insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'PRB 002', 'tractor', 'Scania', 'R 450', 0) returning id`, [fp])).rows[0].id;
const tipoSonda = (await db.query(`select id from tipos_documento where organizacion_id = $1 and aplica = 'unidad' limit 1`, [fp])).rows[0].id;
const gastoSonda = (await db.query(`insert into gastos (organizacion_id, categoria, monto, cargado_por) values ($1, 'peaje', 5000, $2) returning id`, [fp, U.X])).rows[0].id;

// Lo intenta P dentro de una transacción que después se deshace, así cada rol prueba sobre lo mismo.
async function intenta(sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`select set_config('request.jwt.claim.sub', '${U.P}', true); set local role authenticated;`);
    return { filas: (await db.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message.split('\n')[0] };
  } finally {
    await db.exec('rollback');
  }
}
const sinError = async (sql, params) => !(await intenta(sql, params)).error;
const unaFila = async (sql, params) => (await intenta(sql, params)).filas?.[0].n === 1;
const pasaElRol = async (sql, params) => !/No encontramos la unidad/.test((await intenta(sql, params)).error ?? '');

// Funciones de la base que definen cada grupo de roles de la app.
const FUNCIONES = { admin: `es_miembro($1, array['admin']::rol_miembro[])`, gestion: 'es_gestor($1)', gerencia: 'es_gerencia($1)', taller: 'es_mecanico($1)' };
// Lo que hace cada permiso, probado contra la base: true si la base lo deja.
const SONDAS = {
  'tablero.ver': () => sinError('select tablero($1, current_date - 30, current_date)', [fp]),
  'flota.editar': () => sinError(`insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, 'PRB 999', 'tractor', 'Scania', 'R 450', 0)`, [fp]),
  'flota.borrar': () => unaFila('with b as (delete from unidades where id = $1 returning 1) select count(*)::int n from b', [uBorrar]),
  'taller.operar': () => pasaElRol(`select registrar_trabajo($1, null, '', '')`, [uSonda]),
  'gastos.editar': () => unaFila('with b as (delete from gastos where id = $1 returning 1) select count(*)::int n from b', [gastoSonda]),
  'vencimientos.editar': () => sinError('insert into documentos (organizacion_id, tipo_documento_id, unidad_id, vence) values ($1, $2, $3, current_date + 30)', [fp, tipoSonda, uSonda]),
  'equipo.administrar': () => sinError(`insert into invitaciones (organizacion_id, rol, nombre) values ($1, 'chofer', 'Sonda')`, [fp]),
  'actividad.ver': async () => (await intenta('select count(*)::int n from auditoria where organizacion_id = $1', [fp])).filas?.[0].n > 0,
  'ajustes.editar': () => sinError(`insert into tipos_documento (organizacion_id, nombre, aplica) values ($1, 'Sonda', 'unidad')`, [fp]),
  'app.chofer': () => pasaElRol('select iniciar_viaje($1, null, null, null)', [qrSonda]),
  'app.taller': () => pasaElRol(`select registrar_trabajo($1, null, '', '')`, [uSonda]),
  'suscripcion.administrar': async () => (await intenta('select mi_suscripcion($1) s', [fp])).filas?.[0].s != null,
};
// Secciones de sólo lectura: la base deja leer esos datos a todos los miembros (las apps del chofer y del
// taller los usan), así que no hay nada que comparar.
const SOLO_LECTURA = ['flota.ver', 'viajes.ver', 'taller.ver', 'gastos.ver', 'vencimientos.ver', 'proveedores.ver', 'qr.imprimir'];
// Donde la base deja más que la app, a propósito: los tipos de documento los puede cambiar el jefe de taller
// según la base, pero la pantalla Ajustes es sólo del administrador.
const MAS_EN_BASE = ['ajustes.editar'];

const gruposDistintos = [];
const permisosDistintos = [];
for (const rol of ROLES_DE.flota) {
  await db.query(`insert into miembros (organizacion_id, user_id, rol) values ($1, $2, $3)
    on conflict (organizacion_id, user_id) do update set rol = excluded.rol`, [fp, U.P, rol]);
  for (const [grupo, funcion] of Object.entries(FUNCIONES)) {
    const base = (await intenta(`select ${funcion} si`, [fp])).filas?.[0].si === true;
    if (base !== GRUPOS[grupo].includes(rol)) gruposDistintos.push(`${grupo} con ${rol}: la base dice ${base ? 'sí' : 'no'}`);
  }
  for (const [permiso, sonda] of Object.entries(SONDAS)) {
    const base = await sonda();
    const app = puede({ rol, organizacion: { tipo: 'flota' } }, permiso);
    if (app ? !base : base && !MAS_EN_BASE.includes(permiso)) permisosDistintos.push(`${permiso} con ${rol}: app ${app ? 'sí' : 'no'}, base ${base ? 'sí' : 'no'}`);
  }
}
ok(gruposDistintos.length === 0, 'Cada grupo de roles de la app es el mismo que su función en la base' + detalle(gruposDistintos));
ok(permisosDistintos.length === 0, 'Cada permiso que cambia datos coincide con lo que deja la base, para cada rol de una flota' + detalle(permisosDistintos));
ok(Object.keys(PERMISOS).every((p) => p in SONDAS || SOLO_LECTURA.includes(p)), 'Todo permiso tiene su prueba contra la base o está anotado como de sólo lectura');
ok(Object.keys(GRUPOS).every((g) => g in FUNCIONES || Object.keys(SONDAS).some((p) => PERMISOS[p].grupo === g)), 'Todo grupo de roles se compara con la base');

console.log('Pedidos de contratación');
const pedido = [' Transportes Sur ', 'Ana Gómez', 'Ana@Sur.com.ar', '11 5555 0102', 12, 'flota', 'Tenemos taller propio'];
await db.query(`select set_config('request.headers', '{"x-flotapp-ip": "200.1.2.3", "x-flotapp-agente": "Prueba"}', false)`);
const idPedido = (await comoAnonimo('select solicitar_contratacion($1, $2, $3, $4, $5, $6, $7) id', pedido)).rows[0].id;
const guardado = (await db.query('select * from solicitudes where id = $1', [idPedido])).rows[0];
ok(guardado?.empresa === 'Transportes Sur' && guardado.email === 'ana@sur.com.ar' && guardado.estado === 'nueva' && guardado.ip === '200.1.2.3',
  'Cualquiera puede pedir el alta: queda guardado, ordenado y con su IP');
await db.query(`select set_config('request.headers', '', false)`);
let anonLeePedidos = true;
try { await comoAnonimo('select count(*) from solicitudes'); } catch { anonLeePedidos = false; }
let usuarioLeePedidos = true;
try { await como('A', 'select count(*) from solicitudes'); } catch { usuarioLeePedidos = false; }
ok(!anonLeePedidos && !usuarioLeePedidos, 'Nadie lee los pedidos por la API, ni con sesión');
let escribeDirecto = true;
try { await comoAnonimo(`insert into solicitudes (empresa, nombre, email, telefono, unidades, plan) values ('X', 'Y', 'a@b.c', '11111111', 1, 'inicial')`); } catch { escribeDirecto = false; }
ok(!escribeDirecto, 'Sólo se escriben por la función, no directo en la tabla');
let mailRaro = true;
try { await comoAnonimo('select solicitar_contratacion($1, $2, $3, $4, $5, $6, $7)', ['Empresa', 'Ana', 'sin-arroba', '11 5555 0102', 3, 'inicial', null]); } catch { mailRaro = false; }
let sinUnidades = true;
try { await comoAnonimo('select solicitar_contratacion($1, $2, $3, $4, $5, $6, $7)', ['Empresa', 'Ana', 'a@b.com', '11 5555 0102', 0, 'inicial', null]); } catch { sinUnidades = false; }
ok(!mailRaro && !sinUnidades, 'La base rechaza un mail sin forma de mail o cero unidades');
const pedidosIp = [];
for (let i = 0; i < 6; i++) pedidosIp.push((await comoAnonimo(`select consumir_intento('contacto_ip', $1) r`, ['c'.repeat(64)])).rows[0].r);
ok(pedidosIp.slice(0, 5).every(Boolean) && pedidosIp[5] === false, 'Desde la misma conexión, como mucho 5 pedidos por hora');

console.log('Suscripciones');
const planesVisibles = (await comoAnonimo('select clave, precio_mensual, precio_anual from planes order by orden')).rows;
ok(planesVisibles.map((p) => p.clave).join() === 'inicial,flota,empresa,a-medida' && Number(planesVisibles[1].precio_anual) === Number(planesVisibles[1].precio_mensual) * 10,
  'Cualquiera ve los planes, y el anual vale 10 meses');
U.K = '8d8d8d8d-0000-0000-0000-000000000010';
await db.query('insert into auth.users (id) values ($1)', [U.K]);
const fk = (await uno('K', `select crear_organizacion('Flota Prueba', 'flota') id`)).id;
const cuenta = async (user = 'K') => (await uno(user, 'select estado_cuenta($1) e', [fk])).e;
const susK = (await db.query('select plan, estado, prueba_hasta from suscripciones where organizacion_id = $1', [fk])).rows[0];
ok(susK.plan === 'flota' && susK.estado === 'prueba' && Math.round((new Date(susK.prueba_hasta) - Date.now()) / 86400000) === 14 && (await cuenta()) === 'prueba',
  'Una flota nueva arranca con 14 días de prueba del plan Flota, sin tarjeta');
ok((await uno('T', 'select estado_cuenta($1) e', [tal])).e === 'libre' && (await db.query('select count(*)::int n from suscripciones where organizacion_id = $1', [tal])).rows[0].n === 0,
  'Talleres y recapadoras no tienen suscripción: usan Flotapp gratis');
ok((await cuenta('B')) === null, 'Otra empresa no ve el estado de la cuenta');

const altaUnidad = (i) => como('K', `insert into unidades (organizacion_id, dominio, tipo, marca, modelo, km) values ($1, $2, 'tractor', 'Scania', 'R 450', 0) returning id`, [fk, `CUP ${String(i).padStart(3, '0')}`]);
const idsCupo = [];
for (let i = 1; i <= 15; i++) idsCupo.push((await altaUnidad(i)).rows[0].id);
let errorCupo = null;
try { await altaUnidad(16); } catch (e) { errorCupo = e; }
ok(/permite hasta 15/.test(errorCupo?.message ?? '') && errorCupo.hint === 'cupo_unidades', 'Con 15 unidades del plan Flota, la 16 no entra y el error pide subir de plan');
await como('K', `update unidades set estado = 'baja' where id = $1`, [idsCupo[0]]);
await altaUnidad(16);
ok((await uno('K', `select count(*)::int n from unidades where organizacion_id = $1 and estado <> 'baja'`, [fk])).n === 15, 'Dar de baja una unidad libera su lugar');
await debeFallar('K', `update unidades set estado = 'operativa' where id = $1`, [idsCupo[0]], 'Con el plan lleno, reactivar una unidad de baja tampoco entra');

await db.query(`update suscripciones set prueba_hasta = now() - interval '1 minute' where organizacion_id = $1`, [fk]);
ok((await cuenta()) === 'solo_lectura', 'Al terminar la prueba sin pagar, la cuenta queda en modo consulta');
await debeFallar('K', `insert into gastos (organizacion_id, categoria, monto) values ($1, 'peaje', 1000)`, [fk], 'En modo consulta no se cargan gastos');
await debeFallar('K', 'update unidades set km = 1000 where id = $1', [idsCupo[1]], 'Ni se cambian unidades');
ok((await uno('K', 'select count(*)::int n from unidades where organizacion_id = $1', [fk])).n === 16, 'Pero se sigue viendo todo');

const secreto = (await db.query(`select valor from secretos where clave = 'pagos'`)).rows[0].valor;
const enDias = (d) => new Date(Date.now() + d * 86400000).toISOString();
const actualizar = (clave, estado, plan, hasta) => comoAnonimo(
  `select pagos_actualizar_suscripcion($1, $2, $3, 'mensual', $4, 259000, 'mercadopago', 'pre-123', $5, false, 'k@flota.test')`, [clave, fk, plan, estado, hasta]);
let sinSecreto = true;
try { await actualizar('otro', 'activa', 'empresa', null); } catch { sinSecreto = false; }
ok(!sinSecreto, 'Sin el secreto nadie puede activar una suscripción');
await actualizar(secreto, 'activa', 'empresa', enDias(30));
await como('K', `update unidades set estado = 'operativa' where id = $1`, [idsCupo[0]]);
ok((await cuenta()) === 'activa' && (await uno('K', `select count(*)::int n from unidades where organizacion_id = $1 and estado <> 'baja'`, [fk])).n === 16,
  'Con el plan Empresa activo se vuelve a cargar y entran más unidades');

const cobro = (id, estado, hasta) => comoAnonimo(`select pagos_registrar_cobro($1, $2, 'mercadopago', $3, $4, 259000, now(), $5, 'Plan Empresa')`, [secreto, fk, id, estado, hasta]);
await cobro('pago-1', 'rechazado', null);
const conGracia = (await db.query('select estado, gracia_hasta from suscripciones where organizacion_id = $1', [fk])).rows[0];
ok(conGracia.estado === 'pago_pendiente' && Math.round((new Date(conGracia.gracia_hasta) - Date.now()) / 86400000) === 7 && (await cuenta()) === 'gracia',
  'Un cobro rechazado abre 7 días de gracia, en los que se sigue cargando');
await db.query(`update suscripciones set gracia_hasta = now() - interval '1 minute' where organizacion_id = $1`, [fk]);
ok((await cuenta()) === 'solo_lectura', 'Pasada la gracia sin pagar, modo consulta');
await cobro('pago-2', 'aprobado', enDias(60));
await cobro('pago-2', 'aprobado', enDias(60));
const alDia = (await db.query('select estado, gracia_hasta from suscripciones where organizacion_id = $1', [fk])).rows[0];
ok(alDia.estado === 'activa' && alDia.gracia_hasta === null && (await cuenta()) === 'activa', 'Un cobro aprobado deja la cuenta al día');
ok((await db.query(`select count(*)::int n from pagos where proveedor_pago = 'pago-2'`)).rows[0].n === 1, 'El mismo cobro avisado dos veces se anota una sola vez');

const recibir = () => comoAnonimo(`select pagos_recibir_evento($1, 'mercadopago', 'ev-1', 'payment', 'pago-2') r`, [secreto]);
const primeraVez = (await recibir()).rows[0].r;
await comoAnonimo(`select pagos_cerrar_evento($1, 'mercadopago', 'ev-1')`, [secreto]);
ok(primeraVez === true && (await recibir()).rows[0].r === false, 'Un aviso repetido de la pasarela no se procesa dos veces');

await actualizar(secreto, 'cancelada', 'empresa', enDias(10));
ok((await cuenta()) === 'activa', 'Una baja sigue activa hasta el fin del período pago');
await db.query(`update suscripciones set periodo_hasta = now() - interval '4 days' where organizacion_id = $1`, [fk]);
ok((await cuenta()) === 'solo_lectura', 'Y después queda en modo consulta');

await db.query(`insert into miembros (organizacion_id, user_id, rol) values ($1, $2, 'chofer')`, [fk, U.D]);
const mia = (await uno('K', 'select mi_suscripcion($1) s', [fk])).s;
ok(mia?.plan === 'empresa' && mia.max_unidades === 40 && mia.unidades === 16 && mia.pagos.length === 2, 'El administrador ve su plan, el uso y los cobros');
ok((await uno('D', 'select mi_suscripcion($1) s', [fk])).s === null, 'Los demás roles no ven la suscripción');
let leeSuscripcion = true;
try { await como('K', 'select count(*) from suscripciones'); } catch { leeSuscripcion = false; }
let tocaSuscripcion = true;
try { await como('K', `update suscripciones set estado = 'activa'`); } catch { tocaSuscripcion = false; }
ok(!leeSuscripcion && !tocaSuscripcion, 'Nadie toca las suscripciones directo: sólo con las funciones de pago');
await db.query('delete from organizaciones where id = $1', [fk]);
ok((await db.query('select count(*)::int n from unidades where organizacion_id = $1', [fk])).rows[0].n === 0, 'Una flota en modo consulta igual se puede borrar entera');

console.log(fallas ?`\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
