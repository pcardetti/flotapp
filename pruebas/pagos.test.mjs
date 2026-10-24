import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { estadoDeCobro, estadoDeSuscripcion } from '../src/lib/pagos/estados.ts';
import { firmaValida } from '../src/lib/pagos/firma.ts';

const SECRETO = 'clave-secreta-de-prueba';
const firmar = (manifiesto, secreto = SECRETO) => createHmac('sha256', secreto).update(manifiesto).digest('hex');

test('acepta un aviso firmado como lo firma Mercado Pago', () => {
  const v1 = firmar('id:123456;request-id:abc-123;ts:1704908010;');
  assert.equal(firmaValida(`ts=1704908010,v1=${v1}`, 'abc-123', '123456', SECRETO), true);
});

test('el id alfanumérico va en minúsculas al armar la firma', () => {
  const v1 = firmar('id:abc9f;request-id:r-1;ts:1;');
  assert.equal(firmaValida(`ts=1,v1=${v1}`, 'r-1', 'ABC9F', SECRETO), true);
});

test('también acepta el id tal como llega, como firman los SDK oficiales', () => {
  const v1 = firmar('id:ABC9F;request-id:r-1;ts:1;');
  assert.equal(firmaValida(`ts=1,v1=${v1}`, 'r-1', 'ABC9F', SECRETO), true);
});

test('omite lo que el aviso no trae', () => {
  const v1 = firmar('id:77;ts:5;');
  assert.equal(firmaValida(`ts=5,v1=${v1}`, null, '77', SECRETO), true);
});

test('rechaza firmas cambiadas, de otro recurso, sin secreto o mal formadas', () => {
  const v1 = firmar('id:123456;request-id:abc-123;ts:1704908010;');
  assert.equal(firmaValida(`ts=1704908010,v1=${v1}`, 'abc-123', '999999', SECRETO), false);
  assert.equal(firmaValida(`ts=1704908011,v1=${v1}`, 'abc-123', '123456', SECRETO), false);
  assert.equal(firmaValida(`ts=1704908010,v1=${v1}`, 'abc-123', '123456', 'otra-clave'), false);
  assert.equal(firmaValida(`ts=1704908010,v1=${v1}`, 'abc-123', '123456', ''), false);
  assert.equal(firmaValida(null, 'abc-123', '123456', SECRETO), false);
  assert.equal(firmaValida('v1=algo', 'abc-123', '123456', SECRETO), false);
  assert.equal(firmaValida('ts=1704908010,v1=corta', 'abc-123', '123456', SECRETO), false);
});

test('lee el estado de la suscripción de Mercado Pago, escriba canceled o cancelled', () => {
  assert.equal(estadoDeSuscripcion('authorized'), 'activa');
  assert.equal(estadoDeSuscripcion('cancelled'), 'cancelada');
  assert.equal(estadoDeSuscripcion('canceled'), 'cancelada');
  assert.equal(estadoDeSuscripcion('paused'), 'cancelada');
  assert.equal(estadoDeSuscripcion('pending'), null);
});

test('una cuota se aprueba, se rechaza (también mientras se reintenta) o se devuelve; si no, espera', () => {
  assert.equal(estadoDeCobro({ status: 'processed', payment: { id: 1, status: 'approved' } }), 'aprobado');
  assert.equal(estadoDeCobro({ status: 'recycling', payment: { id: 2, status: 'rejected' } }), 'rechazado');
  assert.equal(estadoDeCobro({ status: 'recycling', payment: null }), 'rechazado');
  assert.equal(estadoDeCobro({ status: 'processed', payment: { id: 3, status: 'rejected' } }), 'rechazado');
  assert.equal(estadoDeCobro({ status: 'processed', payment: { id: 4, status: 'refunded' } }), 'devuelto');
  assert.equal(estadoDeCobro({ status: 'processed', payment: { id: 5, status: 'charged_back' } }), 'devuelto');
  assert.equal(estadoDeCobro({ status: 'scheduled', payment: null }), null);
  assert.equal(estadoDeCobro({ status: 'processed', payment: { id: 6, status: 'in_process' } }), null);
});
