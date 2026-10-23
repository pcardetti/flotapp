import { Banknote, Fuel, Plus, Receipt, Ticket } from 'lucide-react';
import type { Metadata } from 'next';
import { EncabezadoMovil, Fila, Seccion, Vacio } from '@/components/movil';
import { Adelante, Pantalla } from '@/components/pantalla';
import { contextoApp } from '@/lib/apps';
import { fechaCorta } from '@/lib/fechas';
import { pesos } from '@/lib/formato';
import { crearClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mis gastos' };

const ICONO: Record<string, React.ReactNode> = {
  combustible: <Fuel className="size-5" />,
  peaje: <Ticket className="size-5" />,
  viatico: <Banknote className="size-5" />,
};
const NOMBRE: Record<string, string> = { combustible: 'Combustible', peaje: 'Peaje', viatico: 'Viático', otro: 'Otro' };

export default async function MisGastos() {
  const { usuario } = await contextoApp('chofer');
  const supabase = await crearClienteServidor();
  const { data: gastos } = await supabase.from('gastos').select('id, categoria, monto, litros, fecha, descripcion')
    .eq('cargado_por', usuario.id).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(50);
  const total = (gastos ?? []).reduce((a, g) => a + Number(g.monto), 0);

  return (
    <>
      <EncabezadoMovil
        titulo="Mis gastos"
        bajada={gastos?.length ? `Total ${pesos(total)}` : undefined}
        accion={<Adelante href="/chofer/gasto" aria-label="Cargar gasto" className="tap grid size-11 place-items-center rounded-full bg-accent text-accent-ink"><Plus className="size-6" /></Adelante>}
      />
      <Pantalla>
        <Seccion>
          {gastos?.length ? (
            gastos.map((g) => (
              <Fila key={g.id}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{ICONO[g.categoria] ?? <Receipt className="size-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.descripcion ?? NOMBRE[g.categoria] ?? g.categoria}</p>
                  <p className="text-sm text-ink-3">{fechaCorta(`${g.fecha}T12:00`)}{g.litros ? ` · ${Number(g.litros).toLocaleString('es-AR')} l` : ''}</p>
                </div>
                <b className="whitespace-nowrap">{pesos(Number(g.monto))}</b>
              </Fila>
            ))
          ) : (
            <Vacio icono={<Receipt className="size-6" />} titulo="No cargaste gastos">Combustible, peajes y viáticos que cargues durante tus viajes van a aparecer acá.</Vacio>
          )}
        </Seccion>
      </Pantalla>
    </>
  );
}
