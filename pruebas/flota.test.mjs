// Reglas de carga de unidades y choferes. Uso: node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerChofer, leerKm, leerUnidad, mensajeDeError, normalizarDominio } from '../src/lib/flota.ts';

const form = (o) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.append(k, v));
  return f;
};
const tractor = { dominio: 'af123kd', tipo: 'tractor', marca: 'Scania', modelo: 'R 450', anio: '2021', km: '412.300', jurisdiccion: 'Nacional', estado: 'operativa' };

test('normaliza patentes Mercosur, anteriores y otras', () => {
  assert.equal(normalizarDominio('af123kd'), 'AF 123 KD');
  assert.equal(normalizarDominio(' AF-123 kd '), 'AF 123 KD');
  assert.equal(normalizarDominio('opq318'), 'OPQ 318');
  assert.equal(normalizarDominio('OPQ 318'), 'OPQ 318');
  assert.equal(normalizarDominio(' 101  ab-234 '), '101 AB 234');
});

test('unidad válida: km con puntos de miles y patente normalizada', () => {
  const { datos, errores } = leerUnidad(form({ ...tractor, cargas_peligrosas: 'on' }), 2026);
  assert.deepEqual(errores, {});
  assert.equal(datos.dominio, 'AF 123 KD');
  assert.equal(datos.km, 412300);
  assert.equal(datos.anio, 2021);
  assert.equal(datos.chofer_id, null);
  assert.equal(datos.cargas_peligrosas, true);
});

test('un tractor necesita kilometraje; un semirremolque no', () => {
  assert.ok(leerUnidad(form({ ...tractor, km: '' }), 2026).errores.km);
  const semi = leerUnidad(form({ ...tractor, tipo: 'semirremolque', km: '' }), 2026);
  assert.deepEqual(semi.errores, {});
  assert.equal(semi.datos.km, null);
});

test('rechaza datos inválidos con un mensaje por campo', () => {
  const { datos, errores } = leerUnidad(form({ ...tractor, dominio: '', marca: '', anio: '1890', km: '412,5', tipo: 'moto', jurisdiccion: 'Uruguay', chofer_id: 'x' }), 2026);
  assert.equal(datos, undefined);
  for (const campo of ['dominio', 'marca', 'anio', 'km', 'tipo', 'jurisdiccion', 'chofer_id']) assert.ok(errores[campo], `falta error en ${campo}`);
  assert.ok(leerUnidad(form({ ...tractor, anio: '2028' }), 2026).errores.anio, 'año futuro');
  assert.deepEqual(leerUnidad(form({ ...tractor, anio: '2027' }), 2026).errores, {}, 'modelo del año próximo');
});

test('chofer: nombre obligatorio y teléfono con caracteres válidos', () => {
  assert.ok(leerChofer(form({ nombre: '  ', telefono: '' })).errores.nombre);
  assert.ok(leerChofer(form({ nombre: 'Ana Paz', telefono: 'llamar a la tarde' })).errores.telefono);
  const { datos } = leerChofer(form({ nombre: '  Ana   Paz ', telefono: '+54 9 341 555-0000' }));
  assert.deepEqual(datos, { nombre: 'Ana Paz', telefono: '+54 9 341 555-0000' });
  assert.equal(leerChofer(form({ nombre: 'Ana', telefono: '' })).datos.telefono, null);
});

test('una lectura de km no puede bajar', () => {
  assert.ok(leerKm(form({ km: '400000' }), 412300).errores.km);
  assert.equal(leerKm(form({ km: '412.300' }), 412300).km, 412300);
  assert.equal(leerKm(form({ km: '413000' }), null).km, 413000);
  assert.ok(leerKm(form({ km: '' }), 1).errores.km);
});

test('traduce los errores de la base', () => {
  assert.match(mensajeDeError({ code: '23505', message: 'duplicate key value violates unique constraint "unidades_organizacion_id_dominio_key"' }), /patente/);
  assert.match(mensajeDeError({ code: '23503', message: 'insert or update on table "unidades" violates foreign key constraint "unidades_chofer_id_organizacion_id_fkey"' }), /chofer/);
  assert.match(mensajeDeError({ code: '23503', message: 'update or delete on table "unidades" violates foreign key constraint "ordenes_unidad_id_organizacion_id_fkey" on table "ordenes"' }), /De baja/);
  assert.match(mensajeDeError({ code: '42501', message: 'new row violates row-level security policy for table "unidades"' }), /rol/);
  assert.equal(mensajeDeError(null), null);
});
