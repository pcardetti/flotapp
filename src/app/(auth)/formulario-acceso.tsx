'use client';

import { useActionState, useState } from 'react';
import { Turnstile, turnstileActivo } from '@/components/turnstile';
import { Aviso, Boton, Campo } from '@/components/ui';
import { ingresar, registrarse, type EstadoForm } from './acciones';

export function FormularioAcceso({ modo, siguiente, boton, nonce }: { modo: 'ingresar' | 'registrarse'; siguiente?: string; boton?: string; nonce?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoForm, FormData>(modo === 'ingresar' ? ingresar : registrarse, {});
  // Con Turnstile, el botón espera el token (suele tardar un segundo y no pide nada).
  const [verificado, setVerificado] = useState(!turnstileActivo);
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
      <Turnstile nonce={nonce} alCambiar={setVerificado} reinicio={estado} />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando || !verificado}>
        {enviando ? 'Un momento…' : !verificado ? 'Verificando…' : boton ?? (modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta')}
      </Boton>
    </form>
  );
}
