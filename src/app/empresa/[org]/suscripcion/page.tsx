import type { Metadata } from 'next';
import { FormConfirmado } from '@/components/confirmar';
import { Toast } from '@/components/controles';
import { Encabezado } from '@/components/encabezado';
import { Pantalla } from '@/components/pantalla';
import { Aviso, Pildora, Tarjeta } from '@/components/ui';
import { abrirSeccion } from '@/lib/empresa';
import { diaDe, diasHasta, fechaCorta } from '@/lib/fechas';
import { pesos } from '@/lib/formato';
import { pasarela } from '@/lib/pagos';
import { planesPublicos, suscripcionDe, type Suscripcion } from '@/lib/suscripcion';
import { cancelarSuscripcion, elegirPlan } from './acciones';
import { ElegirPlan } from './elegir';

export const metadata: Metadata = { title: 'Suscripción' };

const AVISOS: Record<string, string> = {
  'plan-activo': 'Listo: el plan quedó activo',
  pago: 'Mercado Pago está confirmando el pago: en unos minutos se activa el plan',
};

// Cuándo se cobra al elegir un plan, según cómo está la cuenta.
function cuandoSeCobra(s: Suscripcion) {
  if (s.cuenta === 'prueba') return 'Al activar un plan termina la prueba y se hace el primer cobro.';
  if (s.proveedor === 'mercadopago' && s.estado !== 'cancelada') {
    return 'Si cambiás de plan, el precio nuevo rige desde el próximo cobro. Si pasás de mensual a anual, o al revés, el período nuevo se cobra al confirmar y la suscripción anterior se da de baja.';
  }
  return '';
}

const ESTADO_COBRO = { aprobado: ['ok', 'Aprobado'], rechazado: ['crit', 'Rechazado'], pendiente: ['warn', 'Pendiente'], devuelto: ['neutro', 'Devuelto'] } as const;

const cuandoVence = (iso: string) => {
  const dias = diasHasta(diaDe(iso));
  return dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
};

// Qué está pasando con la suscripción, en una pastilla y una oración.
function Estado({ s }: { s: Suscripcion }) {
  const periodo = s.periodo === 'anual' ? 'año' : 'mes';
  const [tono, etiqueta, texto]: [Parameters<typeof Pildora>[0]['tipo'], string, string] =
    s.cuenta === 'prueba' ? ['info', 'Prueba gratis', `La prueba del plan ${s.nombre_plan} termina ${cuandoVence(s.prueba_hasta!)} (${fechaCorta(s.prueba_hasta!)}). Elegí un plan para seguir sin cortes.`]
    : s.cuenta === 'gracia' ? ['warn', 'Pago pendiente', `No pudimos cobrar el último período. Tenés hasta el ${fechaCorta(s.gracia_hasta!)} para regularizarlo; después la cuenta pasa a modo consulta.`]
    : s.cuenta === 'solo_lectura' ? ['crit', 'Modo consulta', 'La prueba o el pago vencieron: se ve todo, pero no se pueden cargar datos hasta activar un plan. No se borró nada.']
    : s.estado === 'cancelada' ? ['warn', 'Baja pedida', `El plan sigue activo hasta el ${fechaCorta(s.periodo_hasta!)}; después la cuenta queda en modo consulta.`]
    : ['ok', 'Activa', s.periodo_hasta
        ? `Plan ${s.nombre_plan}${s.precio ? ` · ${pesos(s.precio)} por ${periodo} + IVA` : ''}. Próximo cobro: ${fechaCorta(s.periodo_hasta)}.`
        : `Plan ${s.nombre_plan}, sin vencimiento.`];
  return (
    <div className="flex flex-col items-start gap-2">
      <Pildora tipo={tono}>{etiqueta}</Pildora>
      <p className="text-ink-2">{texto}</p>
    </div>
  );
}

export default async function PaginaSuscripcion({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { org } = await params;
  const { ok } = await searchParams;
  const { organizacion, usuario } = await abrirSeccion(org, 'suscripcion');
  const [s, planes] = await Promise.all([suscripcionDe(org), planesPublicos()]);

  if (!s) {
    return (
      <Pantalla className="flex flex-col gap-5">
        <Encabezado titulo="Suscripción" bajada={organizacion.nombre} />
        <Aviso>Todavía no está lista la base para las suscripciones: falta ejecutar la migración 0006 en Supabase.</Aviso>
      </Pantalla>
    );
  }
  const uso = s.max_unidades ? Math.min(100, Math.round((s.unidades / s.max_unidades) * 100)) : null;
  const paga = s.estado === 'activa' || s.estado === 'pago_pendiente' || s.estado === 'cancelada';

  return (
    <Pantalla className="flex flex-col gap-5">
      <Toast mensaje={ok ? AVISOS[ok] : null} />
      <Encabezado titulo="Suscripción" bajada={organizacion.nombre} />

      <Tarjeta>
        <Estado s={s} />
        <div className="flex flex-col gap-2">
          <p className="font-semibold">
            Usando <span className="tabular-nums">{s.unidades}</span>
            {s.max_unidades ? <> de <span className="tabular-nums">{s.max_unidades}</span> unidades del plan {s.nombre_plan}</> : ' unidades (sin tope)'}
          </p>
          {uso !== null && (
            <div role="progressbar" aria-label="Unidades en servicio" aria-valuemin={0} aria-valuemax={s.max_unidades!} aria-valuenow={s.unidades}
              className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${uso >= 100 ? 'bg-crit' : uso >= 80 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${uso}%` }} />
            </div>
          )}
          <p className="text-sm text-ink-3">Cuentan las unidades en servicio o en el taller; las dadas de baja no.</p>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-display text-xl font-bold">{paga ? 'Cambiar de plan' : 'Elegir un plan'}</h2>
        <ElegirPlan
          accion={elegirPlan.bind(null, org)}
          planes={planes}
          actual={{ plan: s.plan, periodo: s.periodo, paga }}
          unidades={s.unidades}
          cobroEnLinea={pasarela() !== null}
          emailInicial={usuario.email ?? ''}
        />
        <p className="text-sm text-ink-3">Precios en pesos argentinos, sin IVA. El pago es con tarjeta, a través de Mercado Pago, y se renueva solo. {cuandoSeCobra(s)}</p>
      </Tarjeta>

      {s.pagos.length > 0 && (
        <Tarjeta>
          <h2 className="font-display text-xl font-bold">Pagos</h2>
          <ul className="flex flex-col">
            {s.pagos.map((p, i) => {
              const [tono, texto] = ESTADO_COBRO[p.estado];
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
                  <span className="w-24 tabular-nums text-ink-3">{fechaCorta(p.fecha)}</span>
                  <span className="min-w-0 flex-1">{p.detalle ?? 'Pago'}</span>
                  <b className="tabular-nums">{pesos(p.monto)}</b>
                  <Pildora tipo={tono}>{texto}</Pildora>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      {s.estado === 'activa' && s.periodo_hasta && (
        <Tarjeta className="border-dashed">
          <h2 className="font-display text-xl font-bold">Dar de baja</h2>
          <p className="text-sm text-ink-2">
            La baja rige al terminar el período pago ({fechaCorta(s.periodo_hasta)}). Después la cuenta queda en modo consulta: no se borra nada y podés volver cuando quieras.
          </p>
          <FormConfirmado
            accion={cancelarSuscripcion.bind(null, org)}
            pregunta="¿Dar de baja el plan?"
            detalle={`Sigue todo igual hasta el ${fechaCorta(s.periodo_hasta)}. No se hacen más cobros.`}
            confirmar="Sí, dar de baja"
            hecho="Listo: el plan no se renueva"
          >
            <button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:border-crit hover:text-crit">Dar de baja el plan</button>
          </FormConfirmado>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
