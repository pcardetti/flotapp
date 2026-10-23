'use client';

import { Camera, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { pedirSubida, type Carpeta } from '@/lib/subida-fotos';

type Foto = { id: string; vista: string; estado: 'subiendo' | 'lista' | 'error'; ruta?: string; archivo: File };

export type EstadoFotos = { rutas: string[]; subiendo: boolean };

const LADO_MAXIMO = 1600;

// Achica la foto en el celular antes de subirla: de varios MB a unos 200 KB, con la orientación correcta.
async function comprimir(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.82));
}

// Fotos que se suben directo a Storage, a una URL firmada que prepara el servidor. Con `nombre`, deja las
// rutas en campos ocultos del formulario; con `alCambiar`, avisa las rutas y si todavía hay fotos subiendo.
export function Fotos({ org, carpeta, nombre, maximo = 6, alCambiar, etiqueta = 'Sacar foto' }: {
  org: string;
  carpeta: Carpeta;
  nombre?: string;
  maximo?: number;
  alCambiar?: (e: EstadoFotos) => void;
  etiqueta?: string;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const id = useId();

  const actuales = useRef<Foto[]>([]);
  useEffect(() => {
    actuales.current = fotos;
    alCambiar?.({ rutas: fotos.filter((f) => f.estado === 'lista' && f.ruta).map((f) => f.ruta!), subiendo: fotos.some((f) => f.estado === 'subiendo') });
  }, [fotos, alCambiar]);
  // Al salir de la pantalla se liberan las vistas previas.
  useEffect(() => () => actuales.current.forEach((f) => URL.revokeObjectURL(f.vista)), []);

  async function subir(foto: Foto) {
    setFotos((a) => a.map((f) => (f.id === foto.id ? { ...f, estado: 'subiendo' } : f)));
    try {
      const [blob, destino] = await Promise.all([comprimir(foto.archivo), pedirSubida(org, carpeta)]);
      if ('error' in destino) throw new Error(destino.error);
      const respuesta = await fetch(destino.url, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600', 'x-upsert': 'false' },
        body: blob,
      });
      if (!respuesta.ok) throw new Error(`Storage respondió ${respuesta.status}`);
      setFotos((a) => a.map((f) => (f.id === foto.id ? { ...f, estado: 'lista', ruta: destino.ruta } : f)));
    } catch {
      setFotos((a) => a.map((f) => (f.id === foto.id ? { ...f, estado: 'error' } : f)));
    }
  }

  function agregar(lista: FileList | null) {
    const nuevas = [...(lista ?? [])].filter((a) => a.type.startsWith('image/')).slice(0, maximo - fotos.length)
      .map((archivo): Foto => ({ id: crypto.randomUUID(), vista: URL.createObjectURL(archivo), estado: 'subiendo', archivo }));
    if (!nuevas.length) return;
    setFotos((a) => [...a, ...nuevas]);
    nuevas.forEach(subir);
    navigator.vibrate?.(15);
  }

  function quitar(idFoto: string) {
    setFotos((a) => {
      const f = a.find((x) => x.id === idFoto);
      if (f) URL.revokeObjectURL(f.vista);
      return a.filter((x) => x.id !== idFoto);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <div key={f.id} className="aparecer relative size-20 overflow-hidden rounded-xl border border-line bg-surface-2">
            <img src={f.vista} alt="" className="size-full object-cover" />
            {f.estado === 'subiendo' && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-white"><Loader2 className="size-6 animate-spin" aria-label="Subiendo" /></div>
            )}
            {f.estado === 'error' && (
              <button type="button" onClick={() => subir(f)} className="absolute inset-0 grid place-items-center bg-crit/80 text-xs font-semibold text-white" aria-label="Reintentar la subida">
                <RotateCcw className="size-5" />
              </button>
            )}
            <button type="button" onClick={() => quitar(f.id)} aria-label="Quitar foto" className="tap absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white">
              <X className="size-3.5" />
            </button>
            {nombre && f.estado === 'lista' && <input type="hidden" name={nombre} value={f.ruta} />}
          </div>
        ))}
        {fotos.length < maximo && (
          <button type="button" onClick={() => camara.current?.click()} className="tap flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-ink-3/60 text-ink-2 hover:border-accent hover:text-ink">
            <Camera className="size-6" />
            <span className="text-[0.7rem] font-semibold">{fotos.length ? 'Otra' : etiqueta}</span>
          </button>
        )}
      </div>
      {fotos.length < maximo && (
        <button type="button" onClick={() => galeria.current?.click()} className="self-start text-sm font-semibold text-ink-2 underline-offset-2 hover:underline">
          <ImagePlus className="mr-1 inline size-4 align-[-3px]" />Elegir de la galería
        </button>
      )}
      {fotos.some((f) => f.estado === 'error') && <p className="text-sm font-semibold text-crit">Una foto no se pudo subir. Tocala para reintentar.</p>}
      <input ref={camara} id={`${id}-camara`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
      <input ref={galeria} id={`${id}-galeria`} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
