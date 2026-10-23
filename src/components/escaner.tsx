'use client';

import { Keyboard, ScanLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Detector = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type ClaseDetector = new (opciones: { formats: string[] }) => Detector;
type Lector = (video: HTMLVideoElement) => Promise<string[]>;

// Android trae un lector de QR en el navegador. En iPhone no: ahí se decodifica cada cuadro con jsQR,
// que se descarga sólo en ese caso.
async function crearLector(): Promise<Lector | null> {
  const Clase = (globalThis as unknown as { BarcodeDetector?: ClaseDetector }).BarcodeDetector;
  if (Clase) {
    const detector = new Clase({ formats: ['qr_code'] });
    return async (v) => (await detector.detect(v).catch(() => [])).map((l) => l.rawValue);
  }
  const { default: jsQR } = await import('jsqr');
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  return async (v) => {
    // Se lee el cuadrado del centro, donde está el marco, achicado para que sea rápido.
    const lado = Math.min(v.videoWidth, v.videoHeight);
    if (!lado) return [];
    const ancho = Math.round(Math.min(lado, 640));
    lienzo.width = lienzo.height = ancho;
    ctx.drawImage(v, (v.videoWidth - lado) / 2, (v.videoHeight - lado) / 2, lado, lado, 0, 0, ancho, ancho);
    const leido = jsQR(ctx.getImageData(0, 0, ancho, ancho).data, ancho, ancho, { inversionAttempts: 'dontInvert' });
    return leido ? [leido.data] : [];
  };
}

// El QR lleva la dirección /u/<código>; también se acepta el código suelto de 8 caracteres.
export function codigoDeQr(texto: string): string | null {
  const t = texto.trim();
  const enUrl = t.match(/\/u\/([A-Za-z0-9]{8})(?:[/?#]|$)/);
  const codigo = (enUrl?.[1] ?? t).toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(codigo) ? codigo : null;
}

// Desde la app del chofer el QR lleva directo al chequeo de salida; desde la del taller, a la ficha de la unidad.
const DESTINO = {
  chofer: (codigo: string) => `/chofer/salida/${codigo}`,
  taller: (codigo: string) => `/u/${codigo}?app=taller`,
};

export function Escaner({ app }: { app: keyof typeof DESTINO }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'iniciando' | 'escaneando' | 'sin-soporte' | 'sin-permiso'>('iniciando');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  // El destino se lee de una referencia para no reiniciar la cámara en cada render.
  const irA = useRef(DESTINO[app]);
  irA.current = DESTINO[app];

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado('sin-soporte');
      return;
    }
    let corriente: MediaStream | null = null;
    let activo = true;
    (async () => {
      const lector = await crearLector().catch(() => null);
      if (!lector) {
        if (activo) setEstado('sin-soporte');
        return;
      }
      try {
        corriente = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!activo || !video.current) {
          corriente.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = corriente;
        await video.current.play();
        setEstado('escaneando');
        while (activo) {
          const leidos = await lector(video.current).catch(() => []);
          const c = leidos.map(codigoDeQr).find(Boolean);
          if (c) {
            navigator.vibrate?.(40);
            activo = false;
            router.push(irA.current(c), { transitionTypes: ['nav-forward'] });
            return;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        if (activo) setEstado('sin-permiso');
      }
    })();
    return () => {
      activo = false;
      corriente?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const c = codigoDeQr(codigo);
    if (!c) {
      setError('El código tiene 8 letras y números, como K7Q2M9XW.');
      return;
    }
    router.push(irA.current(c), { transitionTypes: ['nav-forward'] });
  }

  return (
    <div className="flex flex-col gap-4">
      {estado !== 'sin-soporte' && estado !== 'sin-permiso' ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
          <video ref={video} muted playsInline className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-3/5 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          </div>
          <p className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white drop-shadow">
            {estado === 'iniciando' ? 'Abriendo la cámara…' : 'Apuntá al QR de la unidad'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-6 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-ink"><ScanLine className="size-7" /></div>
          {estado === 'sin-permiso' ? (
            <p className="text-ink-2">No pudimos usar la cámara. Revisá el permiso del navegador o escribí el código de la unidad.</p>
          ) : (
            <p className="text-ink-2">Abrí la <b>cámara del celular</b>, apuntá al QR de la unidad y tocá el enlace que aparece. También podés escribir el código.</p>
          )}
        </div>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-2">
        <label htmlFor="codigo-unidad" className="flex items-center gap-1.5 text-sm font-semibold text-ink-2"><Keyboard className="size-4" />Código debajo del QR</label>
        <div className="flex gap-2">
          <input
            id="codigo-unidad"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setError(''); }}
            maxLength={9}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="K7Q2M9XW"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 font-display text-2xl font-bold tracking-[0.2em] outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
          />
          <button type="submit" className="tap h-14 rounded-2xl bg-accent px-5 font-semibold text-accent-ink">Ir</button>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-crit">{error}</p>}
      </form>
    </div>
  );
}
