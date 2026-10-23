import Link from 'next/link';
import { ViewTransition } from 'react';

// Envuelve el contenido de cada página: entra deslizándose según la dirección de la navegación
// (adelante desde la derecha, atrás desde la izquierda) y sube suave en los cambios sin dirección.
export function Pantalla({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'revelar' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      default="none"
    >
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}

type PropsLink = React.ComponentProps<typeof Link>;

// Ir "hacia adentro" (detalle, formulario) y volver: la animación sigue la dirección.
export function Adelante(props: PropsLink) {
  return <Link {...props} transitionTypes={['nav-forward']} />;
}

export function Atras(props: PropsLink) {
  return <Link {...props} transitionTypes={['nav-back']} />;
}
