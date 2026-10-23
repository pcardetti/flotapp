import type { Metadata } from 'next';
import { Encabezado, Vacio } from '@/components/encabezado';
import { abrirSeccion } from '@/lib/empresa';
import { SECCIONES } from '@/lib/navegacion';

// Secciones de la estructura que todavía no tienen pantalla propia: describen qué van a hacer.
const CONTENIDO: Record<string, { bajada: string; vacio: string; texto: string }> = {
  mantenimiento: {
    bajada: 'Services por km o por fecha, lo que llegue primero',
    vacio: 'Sin tareas de mantenimiento',
    texto: 'Cada unidad va a tener su plan con plantillas para tractores y remolques. Vas a ver qué está vencido, qué está próximo y registrar cada service con su orden.',
  },
  ordenes: {
    bajada: 'Reparaciones y services',
    vacio: 'Sin órdenes de trabajo',
    texto: 'Vas a abrir órdenes en tu taller o derivarlas a un taller vinculado, seguir su avance y cerrarlas con repuestos, mano de obra y días fuera de servicio.',
  },
  vencimientos: {
    bajada: 'RTO, seguros, tacógrafo y licencias',
    vacio: 'Sin documentos cargados',
    texto: 'Cada documento avisa antes de vencer según el plazo de su tipo. Los plazos se editan en Ajustes, porque la normativa cambia.',
  },
  neumaticos: {
    bajada: 'Cada neumático con su código y su historia',
    vacio: 'Sin neumáticos',
    texto: 'Alta con código propio, montaje por posición en el esquema de ejes, rotaciones, envío a recapar y bajas. El historial acompaña al neumático en todas sus vidas.',
  },
  'control-diario': {
    bajada: 'Lo completa el chofer antes de salir',
    vacio: 'Sin controles cargados',
    texto: 'Diez puntos de revisión desde el celular, con kilometraje y observaciones. Una falla se convierte en orden correctiva con un toque.',
  },
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
  ajustes: {
    bajada: 'Plazos y umbrales de tu flota',
    vacio: 'Ajustes en preparación',
    texto: 'Tipos de documento con su vigencia y anticipación de aviso, km y días de aviso para services y dibujo mínimo de neumáticos.',
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
