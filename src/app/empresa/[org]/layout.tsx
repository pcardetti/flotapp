import Link from 'next/link';
import { Marca } from '@/components/ui';
import { NOMBRE_ROL, NOMBRE_TIPO, empresaActual, misEmpresas } from '@/lib/empresa';
import { seccionesPara } from '@/lib/navegacion';
import { salir } from '../../(auth)/acciones';
import { Menu } from './menu';

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { organizacion, rol, usuario } = await empresaActual(org);
  const varias = (await misEmpresas()).length > 1;
  const secciones = seccionesPara(organizacion.tipo, rol).map(({ ruta, titulo }) => ({ ruta, titulo }));

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 pb-14 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8 lg:px-6">
      <aside className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-line bg-bg px-4 pt-4 lg:top-5 lg:mx-0 lg:self-start lg:border-0 lg:px-0 lg:pt-5">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
          <Link href={`/empresa/${org}/panel`} aria-label="Ir al panel"><Marca chica /></Link>
          <div className="min-w-0 text-right lg:text-left">
            <p className="truncate font-semibold">{organizacion.nombre}</p>
            <p className="text-xs text-ink-3">{NOMBRE_TIPO[organizacion.tipo]} · {NOMBRE_ROL[rol]}</p>
          </div>
        </div>
        <Menu org={org} secciones={secciones} />
        <div className="hidden flex-col gap-2 border-t border-line pt-3 text-sm lg:flex">
          <span className="truncate text-ink-3">{usuario.email}</span>
          {varias && <Link href="/empresas" className="font-semibold text-accent hover:underline">Cambiar de empresa</Link>}
          <Link href="/empresa/nueva" className="font-semibold text-accent hover:underline">Dar de alta otra empresa</Link>
          <form action={salir}><button className="font-semibold text-ink-2 hover:underline">Salir</button></form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 lg:pt-5">{children}</main>
      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-4 text-sm lg:hidden">
        <span className="text-ink-3">{usuario.email}</span>
        {varias && <Link href="/empresas" className="font-semibold text-accent">Cambiar de empresa</Link>}
        <form action={salir}><button className="font-semibold text-ink-2">Salir</button></form>
      </footer>
    </div>
  );
}
