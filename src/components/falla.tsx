import { Pildora } from '@/components/ui';
import { cuando } from '@/lib/fechas';
import { GRAVEDAD, nombreSistema } from '@/lib/taller';

export type FallaVista = {
  id: string;
  sistema: string;
  descripcion: string | null;
  gravedad: keyof typeof GRAVEDAD;
  estado: string;
  fotos: string[];
  creada_en: string;
  chofer?: string | null;
  orden_id?: string | null;
};

// Tarjeta de falla: qué parte, qué tan grave, quién avisó y las fotos (enlaces firmados).
export function TarjetaFalla({ falla, urls, children }: { falla: FallaVista; urls: Record<string, string>; children?: React.ReactNode }) {
  const g = GRAVEDAD[falla.gravedad] ?? GRAVEDAD.moderada;
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border bg-surface p-3.5 ${falla.gravedad === 'critica' ? 'border-crit' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{nombreSistema(falla.sistema)}</p>
          {falla.descripcion && falla.descripcion !== nombreSistema(falla.sistema) && <p className="text-sm text-ink-2">{falla.descripcion}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pildora tipo={g.tono}>{g.texto}</Pildora>
          {falla.estado === 'en_reparacion' && <Pildora tipo="info">En reparación</Pildora>}
        </div>
      </div>
      {falla.fotos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {falla.fotos.map((f) =>
            urls[f] ? (
              <a key={f} href={urls[f]} target="_blank" rel="noreferrer" className="tap block size-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <img src={urls[f]} alt="Foto de la falla" loading="lazy" className="size-full object-cover" />
              </a>
            ) : null,
          )}
        </div>
      )}
      <p className="text-xs text-ink-3">{falla.chofer ? `${falla.chofer} · ` : ''}{cuando(falla.creada_en)}</p>
      {children}
    </div>
  );
}
