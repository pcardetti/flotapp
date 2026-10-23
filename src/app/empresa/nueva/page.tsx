import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/ui';
import { misEmpresas } from '@/lib/empresa';
import { usuarioActual } from '@/lib/supabase/server';
import { FormularioEmpresa } from './formulario';

export const metadata: Metadata = { title: 'Alta de empresa' };

export default async function NuevaEmpresa() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/ingresar?siguiente=/empresa/nueva');
  const tiene = (await misEmpresas()).length > 0;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-4 py-10">
      <Marca chica />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">{tiene ? 'Dar de alta otra empresa' : 'Tu empresa'}</h1>
        <p className="text-ink-2">Vas a quedar como administrador. Después podés invitar a tu equipo y vincular talleres o flotas.</p>
      </div>
      <FormularioEmpresa />
      {tiene && <Link href="/empresas" className="text-sm font-semibold text-accent hover:underline">Volver a mis empresas</Link>}
    </main>
  );
}
