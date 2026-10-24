import { CircleAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import { diaDe, diasHasta, fechaCorta } from '@/lib/fechas';
import { cuentaDe, suscripcionDe } from '@/lib/suscripcion';

// Franja arriba de cada pantalla cuando la cuenta necesita atención: la prueba gratis corriendo (sólo para el
// administrador), un cobro rechazado con sus días de gracia, o el modo consulta (para todos, porque nadie puede
// cargar datos). Con la cuenta al día no muestra nada.
export async function AvisoCuenta({ org, admin, movil = false }: { org: string; admin: boolean; movil?: boolean }) {
  const cuenta = await cuentaDe(org);
  if (!cuenta || cuenta === 'libre' || cuenta === 'activa' || (!admin && cuenta !== 'solo_lectura')) return null;
  const s = admin ? await suscripcionDe(org) : null;
  const enlace = `/empresa/${org}/suscripcion`;
  const caja = `flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm ${movil ? 'mx-4 mt-4' : ''}`;

  if (cuenta === 'prueba') {
    const dias = s?.prueba_hasta ? Math.max(0, diasHasta(diaDe(s.prueba_hasta))) : null;
    return (
      <div role="status" className={`${caja} bg-accent-soft text-ink`}>
        <Clock className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          Prueba gratis del plan {s?.nombre_plan ?? 'Flota'}
          {dias !== null && <>: {dias === 0 ? 'termina hoy' : dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}</>}.
        </span>
        <Link href={enlace} className="font-semibold text-accent-text underline-offset-2 hover:underline">Elegir plan</Link>
      </div>
    );
  }
  if (cuenta === 'gracia') {
    return (
      <div role="alert" className={`${caja} bg-warn-soft text-warn`}>
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          No pudimos cobrar el plan.{s?.gracia_hasta && <> Tenés hasta el {fechaCorta(s.gracia_hasta)} para regularizarlo; después la cuenta pasa a modo consulta.</>}
        </span>
        <Link href={enlace} className="font-semibold underline-offset-2 hover:underline">Ver suscripción</Link>
      </div>
    );
  }
  return (
    <div role="alert" className={`${caja} bg-crit-soft text-crit`}>
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">
        La cuenta está en modo consulta: se ve todo, pero no se pueden cargar datos.{' '}
        {admin ? 'Activá un plan para seguir trabajando.' : 'Avisale a quien administra la empresa.'}
      </span>
      {admin && <Link href={enlace} className="font-semibold underline-offset-2 hover:underline">Activar un plan</Link>}
    </div>
  );
}
