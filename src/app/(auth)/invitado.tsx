import { NOMBRE_ROL, type Rol } from '@/lib/empresa';
import { tokenDeInvitacion, verInvitacion, type VistaInvitacion } from '@/lib/invitaciones';

// Si el formulario de acceso viene de una invitación vigente, la empresa y el rol quedan a la vista:
// al enviarlo, la persona entra directo (ver `entrar` en acciones.ts).
export async function invitacionVigente(siguiente?: string): Promise<VistaInvitacion | null> {
  const token = tokenDeInvitacion(siguiente);
  const inv = token ? await verInvitacion(token) : null;
  return inv?.estado === 'vigente' ? inv : null;
}

export function TarjetaInvitado({ inv, accion }: { inv: VistaInvitacion; accion: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-accent bg-accent-soft px-4 py-3">
      <p>Te invitaron a <b>{inv.empresa}</b> como <b>{(NOMBRE_ROL[inv.rol as Rol] ?? inv.rol).toLowerCase()}</b>.</p>
      <p className="text-sm text-ink-2">{accion}</p>
    </div>
  );
}
