import assert from 'node:assert/strict';
import test from 'node:test';
import { esPermiso, GRUPOS, PERMISOS, puede, ROLES, ROLES_DE, TIPOS } from '../src/lib/permisos.ts';

const en = (tipo, rol) => ({ rol, organizacion: { tipo } });

test('los grupos y los roles de cada tipo de empresa usan roles que existen', () => {
  for (const roles of [...Object.values(GRUPOS), ...Object.values(ROLES_DE)]) {
    for (const rol of roles) assert.ok(ROLES.includes(rol), rol);
  }
  for (const tipo of TIPOS) assert.ok(ROLES_DE[tipo].includes('admin'), `${tipo} tiene administrador`);
});

test('cada permiso usa un grupo que existe y se lee bien después de "No podés"', () => {
  for (const [permiso, regla] of Object.entries(PERMISOS)) {
    assert.ok(regla.grupo in GRUPOS, permiso);
    assert.match(regla.que, /^[a-záéíóú]/, permiso);
  }
});

test('el administrador puede todo lo que existe en su tipo de empresa', () => {
  for (const tipo of TIPOS) {
    for (const [permiso, regla] of Object.entries(PERMISOS)) {
      assert.equal(puede(en(tipo, 'admin'), permiso), (regla.tipos ?? ['flota']).includes(tipo), `${permiso} en ${tipo}`);
    }
  }
});

test('consulta sólo tiene permisos para ver', () => {
  const suyos = Object.keys(PERMISOS).filter((p) => puede(en('flota', 'lectura'), p));
  assert.ok(suyos.includes('tablero.ver'));
  assert.deepEqual(suyos.filter((p) => !p.endsWith('.ver') && p !== 'qr.imprimir'), []);
});

test('en talleres y recapadoras no rigen los permisos de la flota', () => {
  assert.equal(puede(en('taller', 'admin'), 'flota.editar'), false);
  assert.equal(puede(en('recapadora', 'admin'), 'equipo.administrar'), true);
  assert.equal(puede(en('taller', 'operario'), 'equipo.administrar'), false);
});

test('choferes y mecánicos usan su app, no la de gestión', () => {
  assert.equal(puede(en('flota', 'chofer'), 'app.chofer'), true);
  assert.equal(puede(en('flota', 'chofer'), 'app.taller'), false);
  assert.equal(puede(en('flota', 'mecanico'), 'app.taller'), true);
  assert.equal(puede(en('flota', 'mecanico'), 'tablero.ver'), false);
});

test('sólo reconoce los permisos de la tabla', () => {
  assert.equal(esPermiso('gastos.editar'), true);
  for (const otro of ['toString', '__proto__', 'constructor', 'gastos', '', null, undefined, 1]) assert.equal(esPermiso(otro), false, String(otro));
});
