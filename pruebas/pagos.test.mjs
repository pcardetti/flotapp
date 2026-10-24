import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
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
