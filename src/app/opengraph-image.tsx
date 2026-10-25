import { ImageResponse } from 'next/og';

// La tarjeta que muestran WhatsApp, LinkedIn o un buscador al compartir un enlace de Tallerflota (también las
// invitaciones): fondo claro, el isotipo del medidor, la marca en índigo y una patente.
export const alt = 'Tallerflota: mantenimiento de flotas de camiones';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INDIGO = '#4338ca';
const NOCHE = '#161a2e';
const AGUJA = '#8b85ff';

// El isotipo: un medidor con la aguja marcando cuánto falta para el próximo service.
const ISOTIPO = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" rx="22" fill="${NOCHE}"/>` +
    '<path d="M20 58a24 24 0 0 1 48 0" fill="none" stroke="#4b4f6b" stroke-width="7" stroke-linecap="round"/>' +
    `<path d="M20 58a24 24 0 0 1 38-19.5" fill="none" stroke="${AGUJA}" stroke-width="7" stroke-linecap="round"/>` +
    '<path d="M44 58 58 40" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="44" cy="58" r="5" fill="#fff"/></svg>',
).toString('base64')}`;

export default function ImagenParaCompartir() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#f4f5f7', color: NOCHE }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={ISOTIPO} width={88} height={88} alt="" />
          {/* Dos palabras pegadas: Satori separa los nodos de texto sueltos con un espacio. */}
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 600 }}><span>taller</span><span style={{ color: INDIGO }}>flota</span></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 980 }}>Cada camión con su historia, al día.</div>
          <div style={{ fontSize: 34, color: '#454b63', maxWidth: 960, lineHeight: 1.3 }}>
            Services, fallas, gastos y vencimientos. Chofer, taller y administración conectados.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* Patente Mercosur: blanca con la franja azul arriba. */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px 4px', background: '#ffffff', border: '3px solid #1b1b1b', borderTop: '12px solid #1f4fa8', borderRadius: 8, fontSize: 40, fontWeight: 700, letterSpacing: 4, color: '#111111' }}>
            AF 123 KD
          </div>
          <div style={{ fontSize: 28, color: '#5a6079' }}>Para flotas de camiones de Argentina</div>
        </div>
      </div>
    ),
    size,
  );
}
