import assert from 'node:assert/strict';
import test from 'node:test';
import { rutaInterna } from '../src/lib/rutas.ts';

test('acepta rutas de la app con su búsqueda', () => {
  assert.equal(rutaInterna('/empresas'), '/empresas');
  assert.equal(rutaInterna('/invitacion/abc?x=1#y'), '/invitacion/abc?x=1#y');
  assert.equal(rutaInterna('/empresa/123/flota/unidades/456?ok=guardada'), '/empresa/123/flota/unidades/456?ok=guardada');
});

test('rechaza destinos que llevan a otro sitio', () => {
  for (const malo of ['//sitio.test', '/\\sitio.test', '/\\/sitio.test', 'https://sitio.test', 'javascript:alert(1)', 'sitio.test', '/\t/sitio.test', '/\n/sitio.test', ' /empresas']) {
    assert.equal(rutaInterna(malo), '/empresas', JSON.stringify(malo));
  }
});

test('valores vacíos o raros vuelven al inicio', () => {
  assert.equal(rutaInterna(null), '/empresas');
  assert.equal(rutaInterna(undefined), '/empresas');
  assert.equal(rutaInterna(''), '/empresas');
  assert.equal(rutaInterna('/' + 'a'.repeat(3000)), '/empresas');
  assert.equal(rutaInterna('//x', '/chofer'), '/chofer');
});
