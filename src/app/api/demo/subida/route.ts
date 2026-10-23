import { modoDemo } from '@/lib/demo/activo';

// Destino de las fotos en el modo demo: acepta la subida sin guardarla. Fuera del demo no existe.
export async function PUT() {
  if (!modoDemo()) return new Response(null, { status: 404 });
  await new Promise((listo) => setTimeout(listo, 700));
  return Response.json({ Key: 'demo' });
}
