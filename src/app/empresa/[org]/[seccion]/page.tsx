import type { Metadata } from 'next';
import { Encabezado, Vacio } from '@/components/encabezado';
import { abrirSeccion } from '@/lib/empresa';
import { SECCIONES } from '@/lib/navegacion';

// Secciones de talleres y recapadoras que todavía no tienen pantalla propia: describen qué van a hacer.
const CONTENIDO: Record<string, { bajada: string; vacio: string; texto: string }> = {
  trabajos: {
    bajada: 'Órdenes que te derivaron tus flotas clientes',
    vacio: 'Sin trabajos asignados',
    texto: 'Vas a ver cada orden con la unidad y el problema, informar el avance, cargar repuestos y mano de obra, y cerrarla.',
  },
  recapados: {
    bajada: 'Neumáticos enviados a recapar',
    vacio: 'Sin neumáticos recibidos',
    texto: 'Cada neumático llega con su historial. Registrás el dibujo nuevo y el costo, o lo rechazás si no es recapable.',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ seccion: string }> }): Promise<Metadata> {
  const { seccion } = await params;
  return { title: SECCIONES.find((s) => s.ruta === seccion)?.titulo ?? 'Flotapp' };
}

export default async function Seccion({ params }: { params: Promise<{ org: string; seccion: string }> }) {
  const { org, seccion } = await params;
  await abrirSeccion(org, seccion);
  const titulo = SECCIONES.find((s) => s.ruta === seccion)!.titulo;
  const c = CONTENIDO[seccion];
  return (
    <>
      <Encabezado titulo={titulo} bajada={c?.bajada} />
      {c && <Vacio titulo={c.vacio}>{c.texto}</Vacio>}
    </>
  );
}
