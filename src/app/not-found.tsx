import { BotonLink, Marca } from '@/components/ui';

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4">
      <Marca chica />
      <h1 className="font-display text-3xl font-bold">No encontramos esta página</h1>
      <p className="text-ink-2">Puede que la dirección esté mal o que no tengas acceso a esta empresa o sección.</p>
      <div><BotonLink href="/empresas">Ir a mis empresas</BotonLink></div>
    </main>
  );
}
