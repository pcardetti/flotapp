import { CalendarClock, ChevronDown, Gauge, Receipt, ShieldCheck, Smartphone, Truck, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { BotonLink, Marca, Patente } from '@/components/ui';
import { DESCRIPCION, PREGUNTAS, TITULO } from '@/lib/sitio';
import { supabaseConfigurado } from '@/lib/supabase/config';
import { usuarioActual } from '@/lib/supabase/server';
import { planesPublicos } from '@/lib/suscripcion';
import { sitioPublico } from '@/lib/url';
import { PlanesYContratacion } from './planes';

export const metadata: Metadata = {
  title: { absolute: `${TITULO} en Argentina` },
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'es_AR', siteName: 'Flotapp', url: '/', title: TITULO, description: DESCRIPCION },
};

const APPS = [
  { icono: Gauge, nombre: 'Flotapp', para: 'Administración', texto: 'Tablero de costos por unidad, por chofer y por mes. Flota, viajes, gastos, vencimientos y equipo.' },
  { icono: Truck, nombre: 'Flotapp Chofer', para: 'Choferes', texto: 'Escanea el QR del camión, hace el chequeo de salida y carga combustible, gastos y fallas con fotos. Botones grandes, para usar con una mano.' },
  { icono: Wrench, nombre: 'Flotapp Taller', para: 'Mecánicos', texto: 'Lo pendiente primero, con las fallas críticas arriba. Cada trabajo queda registrado con fotos, repuestos y mano de obra.' },
];

const PASOS = [
  'Cargás tus unidades y choferes, e imprimís el QR de cada camión.',
  'Invitás a tu equipo con un enlace por WhatsApp. Cada persona entra a la app de su rol.',
  'Antes de salir, el chofer escanea el QR y revisa la unidad. Si falla algo crítico, no sale y el taller se entera con fotos.',
  'El taller registra el trabajo y su costo. Vos ves el tablero y lo que está por vencer.',
];

const VENTAJAS = [
  { icono: CalendarClock, titulo: 'Vencimientos a la vista', texto: 'RTO, seguro, tacógrafo y licencias de cada unidad y cada chofer, con lo que vence pronto primero.' },
  { icono: Receipt, titulo: 'Costo real por kilómetro', texto: 'Combustible, peajes, viáticos, repuestos y mano de obra en un solo tablero, por unidad y por chofer.' },
  { icono: ShieldCheck, titulo: 'Cada empresa ve sólo lo suyo', texto: 'La base de datos controla quién puede ver y cambiar cada cosa, y los cambios importantes quedan registrados.' },
  { icono: Smartphone, titulo: 'En cualquier celular', texto: 'Se usa desde el navegador y se instala como una app, sin pasar por la tienda.' },
];

export default async function Inicio() {
  const usuario = supabaseConfigurado() ? await usuarioActual() : null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const planes = supabaseConfigurado() ? await planesPublicos() : [];
  const precios = planes.flatMap((p) => (p.precio_mensual === null ? [] : [p.precio_mensual]));
  // Datos estructurados para los buscadores: qué es Flotapp, sus precios y las preguntas frecuentes de esta página.
  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Flotapp',
        url: sitioPublico(),
        description: DESCRIPCION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS',
        inLanguage: 'es-AR',
        ...(precios.length ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'ARS', lowPrice: Math.min(...precios), highPrice: Math.max(...precios), offerCount: planes.length } } : {}),
      },
      { '@type': 'FAQPage', mainEntity: PREGUNTAS.map((p) => ({ '@type': 'Question', name: p.pregunta, acceptedAnswer: { '@type': 'Answer', text: p.respuesta } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, '\\u003c') }} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <Link href="/" aria-label="Flotapp, inicio"><Marca chica /></Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <a href="#como-funciona" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 md:block">Cómo funciona</a>
          <a href="#planes" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 md:block">Planes</a>
          <a href="#preguntas" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 md:block">Preguntas</a>
          {usuario ? (
            <BotonLink href="/empresas">Ir a mis empresas</BotonLink>
          ) : (
            <>
              <Link href="/ingresar" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2">Ingresar</Link>
              <BotonLink href="#planes">Contratar</BotonLink>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-6">
            <span className="eyebrow">Mantenimiento de flotas de camiones · Argentina</span>
            <h1 className="font-display text-5xl font-bold leading-[1.02] sm:text-6xl">Cada camión con su historia, al día.</h1>
            <p className="max-w-2xl text-lg text-ink-2">
              Flotapp junta en un solo lugar los services, las fallas, los gastos y los vencimientos de tu flota. El chofer avisa desde el
              celular, el taller lo resuelve y vos ves cuánto te cuesta cada kilómetro.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <BotonLink href="#planes">Ver planes y precios</BotonLink>
              <BotonLink href="#como-funciona" variante="secundario">Ver cómo funciona</BotonLink>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
              <Patente dominio="AF 123 KD" /> <Patente dominio="OPQ 318" /> Patentes Mercosur y del formato anterior.
            </p>
          </div>

          {/* Una muestra de lo que se ve en el tablero (decorativa: lo mismo está dicho en el texto). */}
          <div aria-hidden className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-tarjeta">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Tablero · este mes</span>
              <span className="text-xs text-ink-3">12 unidades</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-ink-3">Costo por km</p><p className="font-display text-3xl font-bold">$ 837</p></div>
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-ink-3">Consumo</p><p className="font-display text-3xl font-bold">36,9 l</p><p className="text-xs text-ink-3">cada 100 km</p></div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <Patente dominio="AF 123 KD" />
              <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">Lista para salir</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <Patente dominio="AE 908 TR" />
              <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">RTO vence en 12 días</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <Patente dominio="AG 210 BN" />
              <span className="rounded-full bg-crit-soft px-2.5 py-1 text-xs font-semibold text-crit">En el taller: frenos</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="apps" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="apps" className="font-display text-3xl font-bold sm:text-4xl">Tres apps, una sola cuenta</h2>
            <p className="max-w-2xl text-ink-2">Cada persona entra directo a la suya según su rol, y cada una se instala en el celular con su propio ícono.</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {APPS.map(({ icono: Icono, nombre, para, texto }) => (
              <li key={nombre} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icono className="size-5" aria-hidden /></span>
                <div>
                  <h3 className="font-display text-2xl font-bold">{nombre}</h3>
                  <p className="text-sm font-semibold text-ink-3">{para}</p>
                </div>
                <p className="text-ink-2">{texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="como-funciona" aria-labelledby="titulo-como" className="flex scroll-mt-6 flex-col gap-6">
          <h2 id="titulo-como" className="font-display text-3xl font-bold sm:text-4xl">Cómo funciona</h2>
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex flex-col gap-3 border-t-2 border-ink pt-4">
                <span className="font-display text-4xl font-bold text-accent-text">{i + 1}</span>
                <p className="text-ink-2">{paso}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ventajas" className="flex flex-col gap-6">
          <h2 id="ventajas" className="font-display text-3xl font-bold sm:text-4xl">Pensado para la ruta y para la oficina</h2>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {VENTAJAS.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icono className="size-5" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">{titulo}</h3>
                  <p className="text-ink-2">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-3">Para talleres y recapadoras externos: muy pronto van a recibir el trabajo que les derive cada flota.</p>
        </section>

        <PlanesYContratacion planes={planes} empezar={usuario ? '/empresas' : '/registrarse'} />

        <section id="preguntas" aria-labelledby="titulo-preguntas" className="flex scroll-mt-6 flex-col gap-4">
          <h2 id="titulo-preguntas" className="font-display text-3xl font-bold sm:text-4xl">Preguntas frecuentes</h2>
          <div className="flex flex-col">
            {PREGUNTAS.map((p) => (
              <details key={p.pregunta} className="group border-b border-line py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {p.pregunta}
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="max-w-3xl pt-2 text-ink-2">{p.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="empezar" className="flex flex-col items-start gap-4 rounded-2xl bg-accent p-8 text-accent-ink">
          <h2 id="empezar" className="font-display text-3xl font-bold sm:text-4xl">Tu flota, ordenada desde hoy</h2>
          <p className="max-w-2xl opacity-90">Elegís el plan, cargás las unidades y en unos minutos tus choferes ya pueden hacer el chequeo de salida con el QR.</p>
          <a href={usuario ? '/empresas' : '#planes'} className="rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-ink hover:brightness-95">
            {usuario ? 'Ir a mis empresas' : 'Elegir mi plan'}
          </a>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-sm text-ink-3 sm:px-6">
        <span>© {new Date().getFullYear()} Flotapp · Hecho para flotas de Argentina</span>
        <span>Los plazos normativos (RTO, tacógrafo, licencias) los ajusta cada empresa. Verificá siempre la norma vigente.</span>
      </footer>
    </>
  );
}
