'use client';

// Formulario de una acción que no se puede deshacer (borrar, quitar, cancelar): pide confirmación antes de enviar.
export function FormConfirmado({ accion, pregunta, className, children }: { accion: () => Promise<void>; pregunta: string; className?: string; children: React.ReactNode }) {
  return (
    <form action={accion} className={className} onSubmit={(e) => { if (!window.confirm(pregunta)) e.preventDefault(); }}>
      {children}
    </form>
  );
}
