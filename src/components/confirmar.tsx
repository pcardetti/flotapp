'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { avisar } from './avisos';
import { Aviso, Boton } from './ui';

// Lo que devuelven las acciones del servidor que se usan acá: un error para mostrar, o nada si salió bien.
type Resultado = { error?: string } | void;
const errorDe = (r: Resultado) => (r && r.error) || undefined;

type Confirmacion = {
  accion: () => Promise<Resultado>;
  pregunta: string;
  detalle?: string;
  confirmar?: string; // texto del botón que sigue adelante
  hecho?: string; // aviso cuando terminó bien
};

// Cuadro propio para confirmar algo que no se puede deshacer (en lugar del cuadro gris del navegador): "Cancelar"
// queda elegido, Esc o tocar afuera lo cierran, si algo falla lo dice ahí mismo y, si sale bien, avisa.
// En el celular sube como una hoja desde abajo, cerca del pulgar.
function useConfirmacion({ accion, pregunta, detalle, confirmar = 'Sí, eliminar', hecho }: Confirmacion) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  const abrir = () => {
    setError(undefined);
    dialogo.current?.showModal();
  };
  const cerrar = () => dialogo.current?.close();
  const seguir = () =>
    iniciar(async () => {
      const fallo = errorDe(await accion());
      if (fallo) return setError(fallo);
      cerrar();
      if (hecho) avisar(hecho);
    });

  const cuadro = (
    <dialog
      ref={dialogo}
      role="alertdialog"
      aria-labelledby={`${id}-pregunta`}
      aria-describedby={detalle ? `${id}-detalle` : undefined}
      className="dialogo"
      onClick={(e) => { if (e.target === e.currentTarget && !pendiente) cerrar(); }}
      onCancel={(e) => { if (pendiente) e.preventDefault(); }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <h2 id={`${id}-pregunta`} className="font-display text-xl font-bold leading-tight">{pregunta}</h2>
          {detalle && <p id={`${id}-detalle`} className="text-sm text-ink-2">{detalle}</p>}
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {/* Cancelar va primero: es lo que recibe el foco al abrir. En el celular queda abajo, como en las hojas del sistema. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton type="button" variante="secundario" disabled={pendiente} onClick={cerrar} className="h-12 sm:h-10">Cancelar</Boton>
          <Boton type="button" variante="peligro" disabled={pendiente} onClick={seguir} className="h-12 sm:h-10">{pendiente ? 'Un momento…' : confirmar}</Boton>
        </div>
      </div>
    </dialog>
  );
  return { abrir, cuadro };
}

// Formulario cuyo botón, en lugar de enviar, abre el cuadro de confirmación.
export function FormConfirmado({ className, children, ...confirmacion }: Confirmacion & { className?: string; children: React.ReactNode }) {
  const { abrir, cuadro } = useConfirmacion(confirmacion);
  return (
    <>
      <form className={className} onSubmit={(e) => { e.preventDefault(); abrir(); }}>{children}</form>
      {cuadro}
    </>
  );
}

// Lo mismo para un botón que ya está dentro de otro formulario (no se pueden anidar formularios).
export function BotonConfirmado({ className, etiqueta, children, ...confirmacion }: Confirmacion & { className?: string; etiqueta?: string; children: React.ReactNode }) {
  const { abrir, cuadro } = useConfirmacion(confirmacion);
  return (
    <>
      <button type="button" onClick={abrir} aria-label={etiqueta} className={className}>{children}</button>
      {cuadro}
    </>
  );
}

// Formulario chico (por ejemplo, cambiar un rol) que avisa cómo salió en lugar de quedar mudo. No usa la acción
// de formulario de React porque al terminar vuelve los campos a su valor anterior: el rol recién elegido parecería
// no haberse guardado. Si algo falla, sí vuelve al valor que sigue vigente.
export function FormConAviso({ accion, hecho, className, children }: { accion: (form: FormData) => Promise<Resultado>; hecho: string; className?: string; children: React.ReactNode }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formulario = e.currentTarget;
        const datos = new FormData(formulario);
        iniciar(async () => {
          const fallo = errorDe(await accion(datos));
          if (fallo) formulario.reset();
          avisar(fallo ?? hecho, fallo ? 'error' : 'ok');
        });
      }}
    >
      <fieldset disabled={pendiente} className="contents">{children}</fieldset>
    </form>
  );
}
