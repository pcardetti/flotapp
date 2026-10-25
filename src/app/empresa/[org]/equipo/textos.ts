import type { Rol } from '@/lib/empresa';

// Textos de las invitaciones: los usan la página (servidor) y el formulario (navegador).
export const NOMBRE_ROL_INVITACION: Partial<Record<Rol, string>> = { chofer: 'chofer', mecanico: 'mecánico', jefe_taller: 'jefe de taller', lectura: 'consulta', operario: 'operario', admin: 'administrador' };

export function textoWhatsApp(nombre: string, empresa: string, rol: Rol, enlace: string) {
  return `Hola ${nombre.split(' ')[0]}! Te sumé a ${empresa} en Tallerflota como ${NOMBRE_ROL_INVITACION[rol] ?? rol}. Entrá desde este enlace para crear tu cuenta: ${enlace}`;
}
