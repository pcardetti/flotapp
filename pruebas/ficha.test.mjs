// Historia y costos de la ficha de la unidad. Uso: node --test pruebas/
import assert from 'node:assert/strict';
import test from 'node:test';
import { contarPorTipo, costosDelPeriodo, esTrabajo, estadoVencimiento, kmDelPeriodo, lineaDeTiempo } from '../src/lib/ficha.ts';
import { periodoValido, rango } from '../src/lib/periodos.ts';
import { leerFalla } from '../src/lib/taller.ts';

const orden = (o) => ({ id: 'o', numero: 1, tipo: 'correctivo', descripcion: 'Embrague', trabajo: null, estado: 'cerrada', fecha_ingreso: '2026-10-01', fecha_egreso: '2026-10-03', repuestos: 100, mano_obra: 50, ...o });

test('rango de cada período', () => {
  assert.deepEqual(rango('mes', '2026-10-25'), { desde: '2026-10-01', hasta: '2026-10-25' });
  assert.deepEqual(rango('anterior', '2026-03-10'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rango('anterior', '2026-01-10'), { desde: '2025-12-01', hasta: '2025-12-31' });
  assert.deepEqual(rango('90', '2026-10-25'), { desde: '2026-07-28', hasta: '2026-10-25' });
  assert.deepEqual(rango('anio', '2026-10-25'), { desde: '2026-01-01', hasta: '2026-10-25' });
  assert.equal(periodoValido('cualquiera'), 'mes');
  assert.equal(periodoValido(undefined), 'mes');
  assert.equal(periodoValido('90'), '90');
});

test('km del período: como el tablero', () => {
  const l = [{ km: 1000, fecha: '2026-09-20' }, { km: 1500, fecha: '2026-10-05' }, { km: 1800, fecha: '2026-10-20' }, { km: 2000, fecha: '2026-11-02' }];
  assert.equal(kmDelPeriodo(l, '2026-10-01', '2026-10-31'), 800);
  // Sin lecturas anteriores: desde la más baja del período.
  assert.equal(kmDelPeriodo(l.slice(1), '2026-10-01', '2026-10-31'), 300);
  assert.equal(kmDelPeriodo([], '2026-10-01', '2026-10-31'), 0);
  // Sin lecturas en el período: no se movió.
  assert.equal(kmDelPeriodo([{ km: 1000, fecha: '2026-09-20' }], '2026-10-01', '2026-10-31'), 0);
});

test('costos del período: gastos más mantenimiento de las órdenes cerradas, y costo por km', () => {
  const c = costosDelPeriodo({
    desde: '2026-10-01', hasta: '2026-10-31',
    gastos: [
      { categoria: 'combustible', monto: '1000', litros: '300', fecha: '2026-10-02' },
      { categoria: 'neumaticos', monto: 500, litros: null, fecha: '2026-10-10' },
      { categoria: 'peaje', monto: 50, litros: null, fecha: '2026-10-11' },
      { categoria: 'combustible', monto: 9999, litros: 1, fecha: '2026-09-30' },
    ],
    ordenes: [orden({}), orden({ id: 'p', estado: 'abierta', fecha_egreso: null }), orden({ id: 'q', fecha_egreso: '2026-09-01' })],
    lecturas: [{ km: 10000, fecha: '2026-09-29' }, { km: 11000, fecha: '2026-10-20' }],
  });
  assert.equal(c.total, 1700);
  assert.equal(c.km, 1000);
  assert.equal(c.porKm, 1.7);
  assert.equal(c.consumo, 30);
  assert.deepEqual(c.desglose.map((d) => [d.clave, d.monto]), [['combustible', 1000], ['mantenimiento', 150], ['neumaticos', 500], ['peajes', 50]]);
  const vacio = costosDelPeriodo({ desde: '2026-10-01', hasta: '2026-10-31', gastos: [], ordenes: [], lecturas: [] });
  assert.equal(vacio.porKm, null);
  assert.deepEqual(vacio.desglose.map((d) => d.clave), ['combustible', 'mantenimiento', 'neumaticos']);
});

test('línea de tiempo: todo junto, lo último primero, con trabajos y órdenes separados', () => {
  const ev = lineaDeTiempo({
    fallas: [{ id: 'f', sistema: 'frenos', descripcion: 'Pierde aire', gravedad: 'critica', estado: 'abierta', creada_en: '2026-10-20T10:00:00Z', chofer: 'Diego' }],
    ordenes: [orden({ id: 't', fecha_ingreso: '2026-10-15', fecha_egreso: '2026-10-15', tipo: 'preventivo' }), orden({ id: 'a', estado: 'abierta', fecha_egreso: null, fecha_ingreso: '2026-10-22' })],
    viajes: [{ id: 'v', estado: 'terminado', inicio: '2026-10-18T08:00:00Z', fin: '2026-10-19T08:00:00Z', km_inicio: 1000, km_fin: 1820, destino: 'Rosario', chofer: 'Marcelo' }],
    lecturas: [{ id: 'k', km: 1820, fecha: '2026-10-19', origen: 'viaje', creado_en: '2026-10-19T09:00:00Z' }],
  });
  assert.deepEqual(ev.map((e) => e.tipo), ['orden', 'falla', 'km', 'viaje', 'trabajo']);
  assert.equal(ev[1].titulo, 'Falla: Frenos y aire');
  assert.deepEqual(ev[1].pildoras.map((p) => p.texto), ['Crítica', 'Abierta']);
  assert.equal(ev[3].detalle, 'Marcelo · 820 km');
  assert.equal(ev[4].monto, 150);
  assert.equal(ev[0].monto, undefined);
  assert.deepEqual(contarPorTipo(ev), { falla: 1, trabajo: 1, orden: 1, viaje: 1, km: 1 });
  assert.equal(esTrabajo(orden({ fecha_egreso: '2026-10-01' })), true);
});

test('estado de un vencimiento', () => {
  assert.equal(estadoVencimiento(-1), 'vencido');
  assert.equal(estadoVencimiento(0), 'proximo');
  assert.equal(estadoVencimiento(30), 'proximo');
  assert.equal(estadoVencimiento(31), 'ok');
  assert.equal(estadoVencimiento(10, 7), 'ok');
});

test('falla cargada desde la oficina', () => {
  const form = (o) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f; };
  assert.deepEqual(leerFalla(form({ sistema: 'frenos', descripcion: ' Pierde aire ', gravedad: 'critica' })).datos, { sistema: 'frenos', descripcion: 'Pierde aire', gravedad: 'critica' });
  assert.deepEqual(Object.keys(leerFalla(form({ sistema: 'x', gravedad: 'muy' })).errores).sort(), ['descripcion', 'gravedad', 'sistema']);
  assert.equal(leerFalla(form({ sistema: 'luces', gravedad: 'leve' }), true).datos?.descripcion, null);
});
