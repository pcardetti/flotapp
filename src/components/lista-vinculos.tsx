import { Vacio } from '@/components/encabezado';
import { Pildora, Tarjeta } from '@/components/ui';
import { NOMBRE_TIPO, type TipoOrganizacion } from '@/lib/empresa';
import { fechaCorta } from '@/lib/fechas';
import { avisarError, crearClienteServidor } from '@/lib/supabase/server';

const ESTADO = {
  activo: ['ok', 'Activo'],
  pendiente: ['warn', 'Pendiente'],
  revocado: ['neutro', 'Revocado'],
} as const;

type Fila = { id: string; estado: keyof typeof ESTADO; creado_en: string; otra: { nombre: string; tipo: TipoOrganizacion } | null };

// Vínculos de la empresa vistos desde su lado: la flota ve a sus proveedores, el proveedor a sus flotas.
export async function ListaVinculos({ org, lado }: { org: string; lado: 'flota' | 'proveedor' }) {
  const supabase = await crearClienteServidor();
  const otra = lado === 'flota' ? 'otra:organizaciones!vinculos_proveedor_proveedor_id_fkey(nombre, tipo)' : 'otra:organizaciones!vinculos_proveedor_flota_id_fkey(nombre, tipo)';
  const { data, error } = await supabase
    .from('vinculos_proveedor')
    .select(`id, estado, creado_en, ${otra}`)
    .eq(lado === 'flota' ? 'flota_id' : 'proveedor_id', org)
    .order('creado_en', { ascending: false });
  avisarError('vinculos', error);
  const filas = (data ?? []) as unknown as Fila[];

  if (!filas.length) {
    return lado === 'flota' ? (
      <Vacio titulo="Sin proveedores vinculados">
        Cuando vincules un taller, vas a poder derivarle órdenes de trabajo y ver su avance y sus costos. Con una recapadora, vas a enviarle neumáticos y
        recibirlos con la vida nueva registrada. Cada proveedor sólo ve lo que le asignás.
      </Vacio>
    ) : (
      <Vacio titulo="Todavía no tenés flotas clientes">
        Cuando una flota te invite, la invitación aparece acá para que la aceptes. Desde ese momento vas a ver los trabajos que te asigne.
      </Vacio>
    );
  }
  return (
    <Tarjeta>
      <ul className="flex flex-col">
        {filas.map((f) => {
          const [t, e] = ESTADO[f.estado];
          return (
            <li key={f.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
              <span className="flex min-w-0 flex-col">
                <b className="truncate">{f.otra?.nombre ?? 'Empresa'}</b>
                <span className="text-sm text-ink-3">{f.otra ? NOMBRE_TIPO[f.otra.tipo] : ''} · desde {fechaCorta(f.creado_en)}</span>
              </span>
              <Pildora tipo={t}>{e}</Pildora>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
