import { redirect } from 'next/navigation';
import { misEmpresas, type Membresia, type Rol } from '@/lib/empresa';
import { usuarioActual } from '@/lib/supabase/server';

// Tres apps sobre la misma cuenta: cada rol entra directo a la suya.
export type App = 'flota' | 'chofer' | 'taller';

export const NOMBRE_APP: Record<App, string> = { flota: 'Flotapp', chofer: 'Flotapp Chofer', taller: 'Flotapp Taller' };

export function appDeRol(m: Membresia): App {
  if (m.organizacion.tipo !== 'flota') return 'flota';
  if (m.rol === 'chofer') return 'chofer';
  if (m.rol === 'mecanico') return 'taller';
  return 'flota';
}

export function inicioDe(m: Membresia) {
  const app = appDeRol(m);
  if (app === 'chofer') return '/chofer';
  if (app === 'taller') return '/taller';
  return `/empresa/${m.organizacion.id}/panel`;
}

const PUEDE: Record<'chofer' | 'taller', Rol[]> = {
  chofer: ['chofer', 'admin', 'jefe_taller'],
  taller: ['mecanico', 'jefe_taller', 'admin'],
};

// Empresa con la que trabaja la app del chofer o del taller: la primera flota donde la persona tiene ese rol
// (prioriza el rol propio de la app: un chofer antes que un administrador que también maneja).
export async function contextoApp(app: 'chofer' | 'taller') {
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?siguiente=/${app}`);
  const propias = (await misEmpresas()).filter((m) => m.organizacion.tipo === 'flota' && PUEDE[app].includes(m.rol));
  const elegida = propias.find((m) => m.rol === (app === 'chofer' ? 'chofer' : 'mecanico')) ?? propias[0];
  if (!elegida) redirect('/empresas');
  return { usuario, ...elegida };
}
