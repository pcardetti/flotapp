import { ImageResponse } from 'next/og';

// La tarjeta que muestran WhatsApp, LinkedIn o un buscador al compartir un enlace de Flotapp (también las
// invitaciones): fondo claro, la marca con su línea vial y una patente.
export const alt = 'Flotapp: mantenimiento de flotas de camiones';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const AZUL = '#1d4f91';
const VIAL = '#e0a400';

export default function ImagenParaCompartir() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#f2f4f7', color: '#142133' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 84, height: 84, borderRadius: 20, background: AZUL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: 56, fontWeight: 700 }}>F</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 1 }}>Flotapp</div>
            {/* La línea discontinua amarilla de la marca, como una línea de ruta. */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ width: 22, height: 5, background: VIAL }} />)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>Cada camión con su historia, al día.</div>
          <div style={{ fontSize: 34, color: '#47566a', maxWidth: 960, lineHeight: 1.3 }}>
            Services, fallas, gastos y vencimientos. Chofer, taller y administración conectados.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* Patente Mercosur: blanca con la franja azul arriba. */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px 4px', background: '#ffffff', border: '3px solid #1b1b1b', borderTop: '12px solid #1f4fa8', borderRadius: 8, fontSize: 40, fontWeight: 700, letterSpacing: 6, color: '#111111' }}>
            AF 123 KD
          </div>
          <div style={{ fontSize: 28, color: '#66748a' }}>Para flotas de camiones de Argentina</div>
        </div>
      </div>
    ),
    size,
  );
}
