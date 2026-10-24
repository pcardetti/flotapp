import { AlertTriangle, Flag, Fuel, QrCode, Receipt, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { AvisoCuenta } from '@/components/aviso-cuenta';
import { Toast } from '@/components/controles';
import { EncabezadoMovil, Fila, Seccion } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { Patente } from '@/components/ui';
import { contextoApp } from '@/lib/apps';
import { cuando, diasHasta, duracion, fechaCorta } from '@/lib/fechas';
import { km, pesos } from '@/lib/formato';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

// La plantilla de título del layout no alcanza a su propia página de inicio: va el nombre completo.
export const metadata: Metadata = { title: { absolute: 'Flotapp Chofer' } };

const AVISOS: Record<string, string> = {
  'viaje-iniciado': 'Viaje iniciado. ¡Buen viaje!',
  'viaje-terminado': 'Viaje terminado',
  gasto: 'Gasto guardado',
  falla: 'Aviso enviado al taller',
  bienvenida: '¡Bienvenido! Escaneá el QR de tu unidad para empezar',
};

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>) => (Array.isArray(x) ? x[0] : x) ?? null;

export default async function InicioChofer({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { organizacion, usuario } = await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  const [{ data: yo }, { data: viaje, error: e1 }, { data: ultimos }] = await Promise.all([
    supabase.from('miembros').select('chofer:choferes(id, nombre)').eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).maybeSingle(),
    supabase.from('viajes').select('id, inicio, km_inicio, destino, unidad:unidades(id, dominio, marca, modelo)')
      .eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'en_curso').maybeSingle(),
    supabase.from('viajes').select('id, fin, km_inicio, km_fin, destino, unidad:unidades(dominio)')
      .eq('organizacion_id', organizacion.id).eq('user_id', usuario.id).eq('estado', 'terminado').order('fin', { ascending: false }).limit(3),
  ]);
  avisarError('chofer/viaje', e1);
  const chofer = uno(yo?.chofer as Uno<{ id: string; nombre: string }>);
  const unidad = uno(viaje?.unidad as Uno<{ id: string; dominio: string; marca: string; modelo: string }>);

  const [{ data: docs }, { data: gastosViaje }] = await Promise.all([
    chofer
      ? supabase.from('documentos').select('id, vence, tipo:tipos_documento(nombre)').eq('chofer_id', chofer.id).order('vence').limit(3)
      : Promise.resolve({ data: [] as { id: string; vence: string; tipo: unknown }[] }),
    viaje ? supabase.from('gastos').select('monto').eq('viaje_id', viaje.id) : Promise.resolve({ data: [] as { monto: number }[] }),
  ]);
  const alertas = (docs ?? []).map((d) => ({ ...d, dias: diasHasta(d.vence), nombre: uno(d.tipo as Uno<{ nombre: string }>)?.nombre ?? 'Documento' })).filter((d) => d.dias <= 30);
  const gastado = (gastosViaje ?? []).reduce((a, g) => a + Number(g.monto), 0);
  const nombre = chofer?.nombre.split(' ')[0];

  return (
    <>
      <Toast mensaje={ok ? AVISOS[ok] : null} />
      <EncabezadoMovil titulo={nombre ? `Hola, ${nombre}` : 'Hola'} bajada={organizacion.nombre} />
      <AvisoCuenta org={organizacion.id} admin={false} movil />
      <Pantalla>
        {viaje && unidad ? (
          <Seccion>
            <div className="aparecer flex flex-col gap-4 rounded-3xl bg-accent p-5 text-accent-ink shadow-tarjeta">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold uppercase tracking-wider opacity-80">En viaje · {duracion(viaje.inicio)}</span>
                <Patente dominio={unidad.dominio} />
              </div>
              <div>
                <p className="font-display text-3xl font-bold leading-none">{viaje.destino ? `Hacia ${viaje.destino}` : `${unidad.marca} ${unidad.modelo}`}</p>
                <p className="mt-1 text-sm opacity-80">Salida {cuando(viaje.inicio)} con {km(viaje.km_inicio)}</p>
                {gastado > 0 && <p className="text-sm font-semibold">Gastos del viaje: {pesos(gastado)}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Adelante href="/chofer/gasto?categoria=combustible" className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-4 text-sm font-semibold">
                <Fuel className="size-6" />Combustible
              </Adelante>
              <Adelante href="/chofer/gasto" className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-4 text-sm font-semibold">
                <Receipt className="size-6" />Otro gasto
              </Adelante>
              <Adelante href={`/chofer/falla?u=${unidad.id}`} className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-4 text-sm font-semibold">
                <Wrench className="size-6" />Falla
              </Adelante>
            </div>
            <Adelante href="/chofer/viaje/terminar" className="tap flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-bold text-bg shadow-tarjeta">
              <Flag className="size-5" />Terminar viaje
            </Adelante>
          </Seccion>
        ) : (
          <Seccion>
            <Adelante href="/chofer/escanear" className="tap aparecer flex flex-col items-center gap-3 rounded-3xl bg-accent px-6 py-10 text-center text-accent-ink shadow-tarjeta">
              <QrCode className="size-16" strokeWidth={1.6} />
              <span className="font-display text-3xl font-bold leading-none">Escanear unidad</span>
              <span className="max-w-64 text-sm font-medium opacity-80">Escaneá el QR de la unidad para hacer el chequeo y empezar el viaje.</span>
            </Adelante>
          </Seccion>
        )}

        {alertas.length > 0 && (
          <Seccion titulo="Tus documentos">
            {alertas.map((d) => (
              <Fila key={d.id} className={d.dias < 0 ? 'border-crit bg-crit-soft' : 'border-warn bg-warn-soft'}>
                <AlertTriangle className={`size-5 shrink-0 ${d.dias < 0 ? 'text-crit' : 'text-warn'}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.nombre}</p>
                  <p className="text-sm text-ink-2">{d.dias < 0 ? `Venció el ${fechaCorta(d.vence + 'T12:00')}` : d.dias === 0 ? 'Vence hoy' : `Vence en ${d.dias} días`}</p>
                </div>
              </Fila>
            ))}
          </Seccion>
        )}

        <Seccion titulo="Últimos viajes" accion={<Adelante href="/chofer/viajes" className="text-sm font-semibold text-ink-2">Ver todos</Adelante>}>
          {ultimos?.length ? (
            ultimos.map((v) => (
              <Fila key={v.id}>
                <Patente dominio={uno(v.unidad as Uno<{ dominio: string }>)?.dominio ?? '—'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.destino ?? 'Viaje'}</p>
                  <p className="text-sm text-ink-3">Llegada {v.fin ? cuando(v.fin) : '—'}</p>
                </div>
                <b className="whitespace-nowrap">{km((v.km_fin ?? v.km_inicio) - v.km_inicio)}</b>
              </Fila>
            ))
          ) : (
            <p className="px-1 text-sm text-ink-3">Todavía no hiciste viajes con Flotapp.</p>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
