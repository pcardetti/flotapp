'use client';

import { useActionState } from 'react';
import { Aviso, Boton, Campo } from '@/components/ui';
import { ingresar, registrarse, type EstadoForm } from './acciones';

export function FormularioAcceso({ modo, siguiente }: { modo: 'ingresar' | 'registrarse'; siguiente?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoForm, FormData>(modo === 'ingresar' ? ingresar : registrarse, {});
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={accion} className="flex flex-col gap-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <Campo label="Mail" name="email" type="email" autoComplete="email" required defaultValue={estado.email} />
      <Campo
        label="Contraseña"
        name="password"
        type="password"
        autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
        minLength={modo === 'registrarse' ? 8 : undefined}
        ayuda={modo === 'registrarse' ? 'Al menos 8 caracteres.' : undefined}
        required
      />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>
        {enviando ? 'Un momento…' : modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
      </Boton>
    </form>
  );
}
