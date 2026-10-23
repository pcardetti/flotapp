// Prueba el esquema en un Postgres local (PGlite): aislamiento entre empresas, roles, vínculos y neumáticos.
// Desde la raíz del repo:
//   npm install --no-save @electric-sql/pglite@0.5.8
//   node supabase/pruebas/probar_esquema.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [modDir = join(process.cwd(), 'node_modules'), migracion = join(process.cwd(), 'supabase', 'migrations', '0001_esquema_inicial.sql')] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(join(modDir, '@electric-sql', 'pglite', 'dist', 'index.js')).href);
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(readFileSync(migracion, 'utf8'));
console.log('Migración aplicada');

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

console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
