'use client';

import { useState } from 'react';
import { pesos, pesosCorto, SERIES_COSTO } from '@/lib/formato';

const MES = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
const MES_LARGO = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

function maximoRedondo(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

// Barra con las puntas de arriba redondeadas y la base recta (apoyada en el eje).
function barra(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

type Mes = { mes: string; categorias: Record<string, number> };

// Costos de los últimos 12 meses, apilados por categoría. Al pasar el mouse muestra el detalle del mes.
export function CostosMensuales({ meses }: { meses: Mes[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const filas = meses.map((m) => {
    const porSerie = SERIES_COSTO.map((s) => s.categorias.reduce((a, c) => a + Number(m.categorias[c] ?? 0), 0));
    return { mes: m.mes, porSerie, total: porSerie.reduce((a, b) => a + b, 0) };
  });
  const visibles = SERIES_COSTO.filter((_, i) => filas.some((f) => f.porSerie[i] > 0));
  const tope = maximoRedondo(Math.max(...filas.map((f) => f.total)));
  if (!filas.some((f) => f.total > 0)) return <p className="py-10 text-center text-sm text-ink-3">Todavía no hay gastos ni trabajos con costo en los últimos 12 meses.</p>;

  const W = 720, H = 250, iz = 64, de = 8, ar = 14, ab = 26;
  const ancho = W - iz - de, alto = H - ar - ab, paso = ancho / filas.length, bw = Math.min(34, paso * 0.58);
  const y = (v: number) => ar + alto - (v / tope) * alto;
  const ultimo = filas[filas.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {visibles.map((s) => <span key={s.clave} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.nombre}</span>)}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Costos operativos por mes, apilados por categoría">
          {[0, 1, 2, 3, 4].map((t) => {
            const v = (tope * t) / 4;
            return (
              <g key={t}>
                {t > 0 && <line x1={iz} x2={W - de} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />}
                <text x={iz - 8} y={y(v) + 4} textAnchor="end" fill="var(--ink-3)" fontSize="11">{pesosCorto(v)}</text>
              </g>
            );
          })}
          {filas.map((f, i) => {
            const x = iz + paso * i + (paso - bw) / 2;
            let base = y(0);
            const segmentos = f.porSerie.map((v, k) => ({ v, k })).filter((s) => s.v > 0);
            return (
              <g key={f.mes} opacity={activo === null || activo === i ? 1 : 0.45} className="transition-opacity">
                {segmentos.map(({ v, k }, j) => {
                  const h = (v / tope) * alto;
                  const yy = base - h;
                  // 2 px de separación entre segmentos; el de abajo apoya en el eje y el de arriba lleva las puntas redondeadas.
                  const alto_ = j > 0 ? Math.max(0, h - 2) : h;
                  const forma = j === segmentos.length - 1
                    ? <path key={k} d={barra(x, yy, bw, alto_, 4)} fill={SERIES_COSTO[k].color} />
                    : <rect key={k} x={x} y={yy} width={bw} height={alto_} fill={SERIES_COSTO[k].color} />;
                  base = yy;
                  return forma;
                })}
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fill="var(--ink-3)" fontSize="11">{MES(f.mes)}</text>
                <rect x={iz + paso * i} y={ar} width={paso} height={alto} fill="transparent" onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onClick={() => setActivo(activo === i ? null : i)} />
              </g>
            );
          })}
          <line x1={iz} x2={W - de} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeWidth="1" />
          {ultimo.total > 0 && activo === null && (
            <text x={iz + paso * (filas.length - 1) + paso / 2} y={y(ultimo.total) - 8} textAnchor="middle" fill="var(--ink)" fontSize="12" fontWeight="600">{pesosCorto(ultimo.total)}</text>
          )}
        </svg>
        {activo !== null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-48 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-sm shadow-tarjeta"
            style={{ left: `${Math.min(Math.max(((iz + paso * activo + paso / 2) / W) * 100, 18), 82)}%` }}>
            <p className="mb-1.5 font-semibold capitalize">{MES_LARGO(filas[activo].mes)}</p>
            {SERIES_COSTO.map((s, k) => filas[activo].porSerie[k] > 0 && (
              <p key={s.clave} className="flex items-center justify-between gap-4 text-ink-2">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: s.color }} />{s.nombre}</span>
                <span className="tabular-nums text-ink">{pesos(filas[activo].porSerie[k])}</span>
              </p>
            ))}
            <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="tabular-nums">{pesos(filas[activo].total)}</span></p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-ink-2">Ver como tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-ink-3"><th className="py-1.5 pr-3">Mes</th>{visibles.map((s) => <th key={s.clave} className="py-1.5 pr-3 text-right">{s.nombre}</th>)}<th className="py-1.5 text-right">Total</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.mes} className="border-t border-line">
                  <td className="py-1.5 pr-3 capitalize">{MES_LARGO(f.mes)}</td>
                  {visibles.map((s) => <td key={s.clave} className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.porSerie[SERIES_COSTO.indexOf(s)])}</td>)}
                  <td className="py-1.5 text-right font-semibold tabular-nums">{pesos(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// Ranking horizontal con el valor escrito: sirve para categorías, unidades o fallas.
export function Ranking({ filas, vacio }: { filas: { clave: string; etiqueta: React.ReactNode; valor: number; texto: string; color?: string }[]; vacio: string }) {
  const max = Math.max(0, ...filas.map((f) => f.valor));
  if (!filas.length || max === 0) return <p className="py-6 text-center text-sm text-ink-3">{vacio}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <li key={f.clave} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="truncate text-ink-2">{f.etiqueta}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(f.valor / max) * 100}%`, background: f.color ?? 'var(--accent)' }} />
          </span>
          <span className="whitespace-nowrap text-right font-semibold tabular-nums">{f.texto}</span>
        </li>
      ))}
    </ul>
  );
}
