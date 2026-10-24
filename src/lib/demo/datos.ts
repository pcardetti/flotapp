// Datos del modo demo: una flota chica con viajes, fallas con fotos, gastos y vencimientos. Las fechas se calculan desde hoy.

// Filas sueltas, como las devuelve la API de Supabase.
export type Fila = Record<string, any>;
export type Db = Record<string, Fila[]>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const ORG = id(1);
export const YO = id(2);
export const EMAIL_DEMO = 'demo@flotapp.local';
const MECANICO = id(3), JUAN = id(4), DIEGO = id(5);
const [CH1, CH2, CH3, CH4] = [11, 12, 13, 14].map(id);
const [U1, U2, U3, U4, U5] = [21, 22, 23, 24, 25].map(id);
const [V1, V2, V3, V4, V5, V6, V7] = [31, 32, 33, 34, 35, 36, 37].map(id);
const [C1, C2, C3, C4] = [41, 42, 43, 44].map(id);
const [O1, O2, O3, O4, O5] = [61, 62, 63, 64, 65].map(id);
const [T1, T2, T3, T4, T5] = [91, 92, 93, 94, 95].map(id);

const ZONA = 'America/Argentina/Buenos_Aires';
export const hace = (horas: number) => new Date(Date.now() - horas * 36e5).toISOString();
export const dia = (dias = 0) => new Date(Date.now() + dias * 864e5).toLocaleDateString('en-CA', { timeZone: ZONA });
const foto = (carpeta: string, nombre: string) => `${ORG}/${carpeta}/demo-${nombre}.jpg`;

export const ITEMS = [
  { clave: 'neumaticos', nombre: 'Neumáticos y presión', ayuda: 'Cortes, desgaste, presión visible', critico: true, solo_tipos: null },
  { clave: 'frenos', nombre: 'Frenos y aire', ayuda: 'Presión de aire, pérdidas, freno de mano', critico: true, solo_tipos: null },
  { clave: 'luces', nombre: 'Luces y balizas', ayuda: 'Delanteras, traseras, giros y frenado', critico: true, solo_tipos: null },
  { clave: 'direccion', nombre: 'Dirección y suspensión', ayuda: 'Juego en el volante, elásticos, amortiguadores', critico: true, solo_tipos: null },
  { clave: 'enganche', nombre: 'Quinta rueda y enganche', ayuda: 'Traba, perno rey, mangueras y conexiones', critico: true, solo_tipos: ['tractor'] },
  { clave: 'niveles', nombre: 'Aceite y refrigerante', ayuda: 'Niveles en rango', critico: false, solo_tipos: null },
  { clave: 'perdidas', nombre: 'Pérdidas', ayuda: 'Aceite, gasoil o agua debajo de la unidad', critico: false, solo_tipos: null },
  { clave: 'visibilidad', nombre: 'Espejos y parabrisas', ayuda: 'Espejos, limpiaparabrisas y vidrios', critico: false, solo_tipos: null },
  { clave: 'seguridad', nombre: 'Matafuego y balizas', ayuda: 'Matafuego cargado, balizas triangulares, botiquín', critico: false, solo_tipos: null },
  { clave: 'tacografo', nombre: 'Tacógrafo', ayuda: 'Funciona y registra', critico: false, solo_tipos: ['tractor', 'chasis'] },
  { clave: 'documentacion', nombre: 'Documentación a bordo', ayuda: 'Cédula, seguro, RTO y licencia', critico: false, solo_tipos: null },
];

export const itemsDe = (tipo: string) => ITEMS.filter((i) => !i.solo_tipos || i.solo_tipos.includes(tipo));
const todoBien = (tipo: string) => Object.fromEntries(itemsDe(tipo).map((i) => [i.clave, { estado: 'ok' }]));

export function sembrar(): Db {
  const base = { organizacion_id: ORG };
  const choferes = [
    { id: CH1, nombre: 'Marcelo Gómez', telefono: '11 5555-0101' },
    { id: CH2, nombre: 'Juan Pérez', telefono: '11 5555-0102' },
    { id: CH3, nombre: 'Diego Fernández', telefono: '341 555-0103' },
    { id: CH4, nombre: 'Carla Ruiz', telefono: null },
  ].map((c, i) => ({ ...base, ...c, creado_en: hace(24 * (120 - i * 10)) }));

  const miembros = [
    { user_id: YO, rol: 'admin', nombre: 'Marcelo Gómez', chofer_id: CH1, creado_en: hace(24 * 120) },
    { user_id: JUAN, rol: 'chofer', nombre: 'Juan Pérez', chofer_id: CH2, creado_en: hace(24 * 60) },
    { user_id: MECANICO, rol: 'mecanico', nombre: 'Raúl Benítez', chofer_id: null, creado_en: hace(24 * 45) },
    { user_id: DIEGO, rol: 'chofer', nombre: 'Diego Fernández', chofer_id: CH3, creado_en: hace(24 * 30) },
  ].map((m) => ({ ...base, ...m }));

  const unidad = (id: string, dominio: string, tipo: string, marca: string, modelo: string, anio: number, km: number | null, jurisdiccion: string, estado: string, chofer_id: string | null, qr_token: string, cargas_peligrosas = false) =>
    ({ ...base, id, dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, chofer_id, qr_token, cargas_peligrosas, creado_en: hace(24 * 150) });
  const unidades = [
    unidad(U1, 'AF 123 KD', 'tractor', 'Scania', 'R 450', 2021, 412300, 'Nacional', 'operativa', CH1, 'K7Q2M9XW'),
    unidad(U2, 'AE 908 TR', 'tractor', 'Mercedes-Benz', 'Actros 2045', 2020, 538900, 'Nacional', 'operativa', CH2, 'P4X8N2RT', true),
    unidad(U3, 'AD 455 PL', 'chasis', 'Iveco', 'Tector 170E28', 2019, 287450, 'Buenos Aires', 'taller', CH3, 'H9M3W6YB'),
    unidad(U4, 'AA 731 SR', 'semirremolque', 'Helvética', 'Sider 3 ejes', 2018, null, 'Nacional', 'operativa', null, 'Z2C7K5QD'),
    unidad(U5, 'AG 210 BN', 'tractor', 'Volvo', 'FH 540', 2023, 198200, 'Nacional', 'operativa', CH4, 'M6T4R8XA'),
  ];

  const chequeos = [
    { id: C1, unidad_id: U1, chofer_id: CH1, user_id: YO, fecha: hace(3.3), km: 412300, combustible: 75, items: todoBien('tractor'), aprobado: true },
    { id: C2, unidad_id: U2, chofer_id: CH2, user_id: JUAN, fecha: hace(26.1), km: 538900, combustible: 100, items: todoBien('tractor'), aprobado: true },
    {
      id: C3, unidad_id: U3, chofer_id: CH3, user_id: DIEGO, fecha: hace(5), km: 287450, combustible: 50, aprobado: false,
      items: { ...todoBien('chasis'), frenos: { estado: 'problema', nota: 'Pierde aire el circuito trasero, la presión baja a 5 bar.', fotos: [foto('fallas', 'frenos-1'), foto('fallas', 'frenos-2')] } },
    },
    { id: C4, unidad_id: U5, chofer_id: CH3, user_id: DIEGO, fecha: hace(80.2), km: 197520, combustible: 100, items: todoBien('tractor'), aprobado: true },
  ].map((c) => ({ ...base, ...c }));

  const viaje = (id: string, unidad_id: string, chofer_id: string, user_id: string, desde: number, hasta: number | null, km_inicio: number, km_fin: number | null, destino: string, chequeo_id: string | null = null) =>
    ({
      ...base, id, unidad_id, chofer_id, user_id, estado: hasta === null ? 'en_curso' : 'terminado', inicio: hace(desde), fin: hasta === null ? null : hace(hasta),
      km_inicio, km_fin, combustible_inicio: 100, combustible_fin: hasta === null ? null : 25, destino, chequeo_id, observaciones: null,
    });
  const viajes = [
    { ...viaje(V1, U1, CH1, YO, 3.2, null, 412300, null, 'Rosario', C1), combustible_inicio: 75 },
    viaje(V2, U2, CH2, JUAN, 26, null, 538900, null, 'Bahía Blanca', C2),
    viaje(V3, U1, CH1, YO, 56, 48, 411480, 412300, 'Córdoba'),
    viaje(V4, U1, CH1, YO, 120, 110, 410790, 411480, 'Mar del Plata'),
    viaje(V5, U5, CH3, DIEGO, 80, 66, 197520, 198200, 'Neuquén', C4),
    viaje(V6, U3, CH3, DIEGO, 30, 22, 286900, 287450, 'Pergamino'),
    viaje(V7, U2, CH2, JUAN, 76, 60, 537600, 538900, 'Buenos Aires'),
  ];

  const falla = (n: number, unidad_id: string, sistema: string, descripcion: string, gravedad: string, estado: string, fotos: string[], extra: Fila) =>
    ({ ...base, id: id(n), unidad_id, sistema, descripcion, gravedad, estado, fotos, origen: 'viaje', chequeo_id: null, viaje_id: null, orden_id: null, ...extra });
  const fallas = [
    falla(51, U3, 'frenos', 'Pierde aire el circuito trasero, la presión baja a 5 bar.', 'critica', 'abierta', [foto('fallas', 'frenos-1'), foto('fallas', 'frenos-2')],
      { origen: 'chequeo', chequeo_id: C3, chofer_id: CH3, reportada_por: DIEGO, creada_en: hace(5) }),
    falla(52, U1, 'luces', 'No enciende el giro trasero derecho.', 'moderada', 'abierta', [foto('fallas', 'giro-1')], { viaje_id: V1, chofer_id: CH1, reportada_por: YO, creada_en: hace(0.7) }),
    falla(53, U2, 'neumaticos', 'Desgaste irregular en la tercera rueda del lado izquierdo.', 'leve', 'abierta', [], { viaje_id: V2, chofer_id: CH2, reportada_por: JUAN, creada_en: hace(20) }),
    falla(54, U3, 'electricidad', 'Se prende la luz de batería al arrancar.', 'moderada', 'en_reparacion', [foto('fallas', 'tablero-1')],
      { viaje_id: V6, chofer_id: CH3, orden_id: O1, reportada_por: DIEGO, creada_en: hace(72) }),
    falla(55, U5, 'frenos', 'Ruido al frenar en la rueda delantera izquierda.', 'moderada', 'resuelta', [], { viaje_id: V5, chofer_id: CH3, orden_id: O3, reportada_por: DIEGO, creada_en: hace(24 * 13) }),
  ];

  const orden = (oid: string, unidad_id: string, numero: number, tipo: string, descripcion: string, trabajo: string | null, ingreso: number, egreso: number | null, repuestos: number, mano_obra: number, fotos: string[], deja_fuera_servicio = false) =>
    ({
      ...base, id: oid, unidad_id, numero, tipo, descripcion, trabajo, estado: egreso === null ? 'abierta' : 'cerrada', fecha_ingreso: dia(-ingreso),
      fecha_egreso: egreso === null ? null : dia(-egreso), deja_fuera_servicio, repuestos, mano_obra, fotos, proveedor_id: null, creado_en: hace(24 * ingreso),
    });
  const ordenes = [
    orden(O1, U3, 18, 'correctivo', 'Revisar alternador y batería', null, 2, null, 0, 0, []),
    orden(O2, U1, 17, 'preventivo', 'Cambio de aceite y filtros', 'Aceite 15W40 (38 l), filtros de aceite, gasoil y aire.', 6, 6, 485000, 120000, [foto('ordenes', 'aceite-1')]),
    orden(O3, U5, 16, 'correctivo', 'Cambio de pulmón de freno', 'Pulmón delantero izquierdo nuevo; se regularon las zapatas.', 12, 12, 310000, 95000, []),
    orden(O4, U2, 15, 'preventivo', 'Alineación y balanceo', null, 20, 20, 0, 140000, []),
    orden(O5, U3, 14, 'correctivo', 'Cambio de embrague', 'Kit de embrague completo y volante rectificado.', 35, 33, 1650000, 420000, [foto('ordenes', 'embrague-1'), foto('ordenes', 'embrague-2')], true),
  ];

  const gasto = (n: number, categoria: string, monto: number, litros: number | null, dias: number, extra: Fila) =>
    ({ ...base, id: id(n), categoria, monto, litros, fecha: dia(-dias), descripcion: null, foto: null, unidad_id: null, chofer_id: null, viaje_id: null, creado_en: hace(24 * dias + 1), ...extra });
  const gastos = [
    gasto(71, 'combustible', 412500, 236, 0, { unidad_id: U1, chofer_id: CH1, viaje_id: V1, cargado_por: YO, foto: foto('gastos', 'ticket-1'), creado_en: hace(1.5) }),
    gasto(72, 'peaje', 18600, null, 0, { unidad_id: U1, chofer_id: CH1, viaje_id: V1, cargado_por: YO, creado_en: hace(2.6) }),
    gasto(73, 'viatico', 45000, null, 2, { unidad_id: U1, chofer_id: CH1, viaje_id: V3, cargado_por: YO }),
    gasto(74, 'combustible', 398000, 228, 2, { unidad_id: U1, chofer_id: CH1, viaje_id: V3, cargado_por: YO, foto: foto('gastos', 'ticket-2') }),
    gasto(75, 'combustible', 612000, 350, 1, { unidad_id: U2, chofer_id: CH2, viaje_id: V2, cargado_por: JUAN }),
    gasto(76, 'seguro', 1450000, null, 10, { unidad_id: U2, descripcion: 'Póliza del mes', cargado_por: YO }),
    gasto(77, 'neumaticos', 1800000, null, 8, { unidad_id: U5, descripcion: '2 cubiertas 295/80 R22.5', cargado_por: YO }),
    gasto(78, 'peaje', 24300, null, 4, { unidad_id: U1, chofer_id: CH1, viaje_id: V4, cargado_por: YO }),
    gasto(79, 'lavado', 60000, null, 6, { unidad_id: U1, chofer_id: CH1, descripcion: 'Lavado completo', cargado_por: YO }),
    gasto(80, 'combustible', 455000, 260, 3, { unidad_id: U5, chofer_id: CH3, viaje_id: V5, cargado_por: DIEGO }),
  ];

  const tipos_documento = [
    { id: T1, nombre: 'RTO (Revisión Técnica Obligatoria)', aplica: 'unidad' },
    { id: T2, nombre: 'Seguro de responsabilidad civil', aplica: 'unidad' },
    { id: T3, nombre: 'Control del tacógrafo', aplica: 'unidad' },
    { id: T4, nombre: 'Licencia de conducir profesional', aplica: 'chofer' },
    { id: T5, nombre: 'Curso de cargas peligrosas', aplica: 'chofer' },
  ].map((t) => ({ ...base, ...t, vigencia_meses: 12, aviso_dias: 30, nota: null }));

  const documento = (n: number, tipo_documento_id: string, dueno: { unidad_id?: string; chofer_id?: string }, vence: number, numero: string | null = null) =>
    ({ ...base, id: id(n), tipo_documento_id, unidad_id: null, chofer_id: null, ...dueno, numero, vence: dia(vence), foto: null, creado_en: hace(24 * 30) });
  const documentos = [
    documento(101, T1, { unidad_id: U1 }, 120, 'RTO 458221'),
    documento(102, T1, { unidad_id: U2 }, -3),
    documento(103, T2, { unidad_id: U1 }, 18, 'Póliza 7781-22'),
    documento(104, T2, { unidad_id: U2 }, 48),
    documento(105, T4, { chofer_id: CH1 }, 12),
    documento(106, T4, { chofer_id: CH2 }, 200),
    documento(107, T1, { unidad_id: U5 }, 300),
    documento(108, T3, { unidad_id: U1 }, 150),
    documento(109, T5, { chofer_id: CH2 }, -15),
    documento(110, T2, { unidad_id: U5 }, 25),
  ];

  const invitaciones = [
    { ...base, id: id(111), token: 'a1b2'.repeat(16), rol: 'chofer', nombre: 'Carla Ruiz', chofer_id: CH4, vence: hace(-24 * 5), creada_en: hace(48), usada_por: null, usada_en: null, revocada: false },
  ];

  let n = 120;
  const lectura = (unidad_id: string, km: number, dias: number, origen: string) => ({ ...base, id: id(n++), unidad_id, km, fecha: dia(-dias), origen, creado_en: hace(24 * dias) });
  const lecturas_km = [
    lectura(U1, 395000, 150, 'alta'), lectura(U1, 410790, 5, 'chequeo'), lectura(U1, 411480, 4, 'viaje'), lectura(U1, 411480, 2.3, 'chequeo'),
    lectura(U1, 412300, 2, 'viaje'), lectura(U1, 412300, 0.1, 'chequeo'),
    lectura(U2, 512000, 150, 'alta'), lectura(U2, 537600, 3.2, 'chequeo'), lectura(U2, 538900, 2.5, 'viaje'), lectura(U2, 538900, 1.1, 'chequeo'),
    lectura(U3, 279300, 150, 'alta'), lectura(U3, 286900, 1.3, 'chequeo'), lectura(U3, 287450, 0.9, 'viaje'), lectura(U3, 287450, 0.2, 'chequeo'),
    lectura(U5, 181000, 150, 'alta'), lectura(U5, 197520, 3.3, 'chequeo'), lectura(U5, 198200, 2.8, 'viaje'),
  ];

  const celular = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
  const pc = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
  let evento = 0;
  const auditar = (horas: number, user_id: string, quien: string, rol: string, accion: string, categoria: string, detalle: Fila, ip: string, agente: string, recurso_id: string | null = null) =>
    ({ ...base, id: ++evento, user_id, quien, rol, accion, categoria, recurso: accion.split('.')[0], recurso_id, detalle, ip, agente, creado_en: hace(horas) });
  const auditoria = [
    auditar(24 * 30, YO, 'Marcelo Gómez', 'admin', 'miembro.alta', 'equipo', { nombre: 'Marcelo Gómez', rol: 'admin' }, '190.18.44.7', pc, YO),
    auditar(75, YO, 'Marcelo Gómez', 'admin', 'documento.renovado', 'documentos', { tipo: 'RTO (Revisión Técnica Obligatoria)', titular: 'AF 123 KD', de: dia(-5), a: dia(360) }, '190.18.44.7', pc),
    auditar(50, YO, 'Marcelo Gómez', 'admin', 'gasto.borrado', 'gastos', { categoria: 'lavado', monto: 60000, fecha: dia(-2), dominio: 'AF 123 KD' }, '190.18.44.7', pc),
    auditar(27, YO, 'Marcelo Gómez', 'admin', 'miembro.rol', 'equipo', { nombre: 'Raúl Benítez', de: 'chofer', a: 'mecanico' }, '190.18.44.7', pc, MECANICO),
    auditar(26, YO, 'Marcelo Gómez', 'admin', 'invitacion.creada', 'equipo', { nombre: 'Carla Ruiz', rol: 'chofer' }, '190.18.44.7', pc),
    auditar(5, MECANICO, 'Raúl Benítez', 'mecanico', 'falla.descartada', 'taller', { sistema: 'luces', dominio: 'AE 908 TR', gravedad: 'moderada' }, '181.47.12.90', celular),
    auditar(2, MECANICO, 'Raúl Benítez', 'mecanico', 'orden.cerrada', 'taller', { numero: 17, descripcion: 'Cambio de aceite y filtros', dominio: 'AF 123 KD', costo: 605000 }, '181.47.12.90', celular),
    auditar(0.5, DIEGO, 'Diego Fernández', 'chofer', 'permiso.denegado', 'seguridad', { que: 'gastos' }, '186.12.200.31', celular),
  ];

  return {
    organizaciones: [{ id: ORG, nombre: 'Transportes Ejemplo', tipo: 'flota' }],
    miembros, choferes, unidades, chequeos, viajes, fallas, ordenes, gastos, tipos_documento, documentos, invitaciones, lecturas_km,
    items_chequeo: ITEMS, vinculos_proveedor: [], neumaticos: [], auditoria,
    // La misma lista de planes que la migración 0006, y la flota de ejemplo con la prueba gratis corriendo.
    planes: [
      { clave: 'inicial', nombre: 'Inicial', max_unidades: 5, precio_mensual: 49000, precio_anual: 490000, bajada: 'Para ordenar una flota chica desde el primer día.', orden: 1, publico: true },
      { clave: 'flota', nombre: 'Flota', max_unidades: 15, precio_mensual: 119000, precio_anual: 1190000, bajada: 'Para flotas que crecen y suman choferes y mecánicos.', orden: 2, publico: true },
      { clave: 'empresa', nombre: 'Empresa', max_unidades: 40, precio_mensual: 259000, precio_anual: 2590000, bajada: 'Para operaciones grandes, con taller propio.', orden: 3, publico: true },
      { clave: 'a-medida', nombre: 'A medida', max_unidades: null, precio_mensual: null, precio_anual: null, bajada: 'Más de 40 unidades: armamos un precio para tu operación.', orden: 4, publico: true },
    ],
    suscripciones: [{
      organizacion_id: ORG, plan: 'flota', estado: 'prueba', periodo: 'mensual', precio: null, prueba_hasta: new Date(Date.now() + 9 * 864e5).toISOString(),
      periodo_hasta: null, gracia_hasta: null, cancelar_al_terminar: false, proveedor: null, proveedor_suscripcion: null,
    }],
    pagos: [],
  };
}

// Último ingreso de cada integrante del demo.
export const ultimosIngresos = () => [
  { user_id: YO, ultimo_ingreso: hace(0.2) },
  { user_id: JUAN, ultimo_ingreso: hace(26) },
  { user_id: MECANICO, ultimo_ingreso: hace(2) },
  { user_id: DIEGO, ultimo_ingreso: hace(0.6) },
];

// Tablero con números verosímiles para una flota de cinco unidades (pesos de 2026). El estado "ahora" sale de los datos vivos.
export function tablero(db: Db, desde: string, hasta: string) {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(15);
    d.setMonth(d.getMonth() - (11 - i));
    const precio = 1 + (i - 11) * 0.022;
    const parcial = i === 11 ? 23 / 31 : 1;
    const vaiven = (k: number) => 1 + 0.12 * Math.sin(i * 1.7 + k);
    const r = (n: number) => Math.round(n);
    return {
      mes: d.toISOString().slice(0, 7),
      categorias: {
        combustible: r(31e6 * precio * vaiven(1) * parcial),
        mantenimiento: r([3.1, 2.4, 6.8, 2.9, 3.5, 8.9, 2.6, 4.1, 3.3, 7.2, 2.8, 4.4][i] * 1e6 * precio * parcial),
        neumaticos: [0, 3.6, 0, 0, 1.8, 0, 0, 3.6, 0, 1.8, 0, 1.8][i] * 1e6,
        peaje: r(1.1e6 * precio * vaiven(2) * parcial),
        viatico: r(0.45e6 * precio * parcial),
        seguro: r(2.9e6 * precio),
        patente: i % 6 === 2 ? 1.2e6 : 0,
        lavado: r(0.26e6 * parcial),
        multa: i === 7 ? 380000 : 0,
      } as Record<string, number>,
    };
  });
  const enRango = meses.filter((m) => m.mes >= desde.slice(0, 7) && m.mes <= hasta.slice(0, 7));
  const suma = (cat: string) => enRango.reduce((a, m) => a + (m.categorias[cat] ?? 0), 0);
  const categorias = Object.keys(meses[0].categorias);
  const costo = categorias.reduce((a, c) => a + suma(c), 0);
  const combustible = suma('combustible');
  const litros = Math.round(combustible / 1750);
  const km = Math.round(litros / 0.348);
  const k = enRango.length || 1;

  const unidades = db.unidades.filter((u) => u.estado !== 'baja');
  const pesos: Record<string, [number, number, number, number]> = { // km, costo, consumo l/km, fallas
    [U1]: [0.29, 0.25, 0.345, 2], [U2]: [0.33, 0.29, 0.372, 1], [U3]: [0.13, 0.19, 0.29, 3], [U4]: [0, 0.05, 0, 0], [U5]: [0.25, 0.22, 0.331, 1],
  };
  const por_unidad = unidades.map((u) => {
    const [pk, pc, consumo, fallas] = pesos[u.id] ?? [0, 0, 0, 0];
    const kmU = Math.round(km * pk);
    return {
      id: u.id, dominio: u.dominio, marca: u.marca, modelo: u.modelo, estado: u.estado, km: kmU, costo: Math.round(costo * pc), litros: Math.round(kmU * consumo),
      mantenimiento: Math.round(suma('mantenimiento') * pc), viajes: Math.round(kmU / 850), fallas: fallas * k,
    };
  });
  const por_chofer = [
    { id: id(11), nombre: 'Marcelo Gómez', p: 0.29, consumo: 0.345, chequeos: 1.1 },
    { id: id(12), nombre: 'Juan Pérez', p: 0.33, consumo: 0.369, chequeos: 1 },
    { id: id(13), nombre: 'Diego Fernández', p: 0.23, consumo: 0.322, chequeos: 1.2 },
    { id: id(14), nombre: 'Carla Ruiz', p: 0.15, consumo: 0.338, chequeos: 0.9 },
  ].map((c) => {
    const kmC = Math.round(km * c.p);
    const viajes = Math.round(kmC / 850);
    return { id: c.id, nombre: c.nombre, viajes, km: kmC, gastos: Math.round((combustible + suma('peaje') + suma('viatico')) * c.p), litros: Math.round(kmC * c.consumo), fallas: Math.round(c.p * 7 * k), chequeos: Math.round(viajes * c.chequeos) };
  });

  const hoy = dia();
  const en30 = dia(30);
  const abiertas = db.fallas.filter((f) => f.estado === 'abierta' || f.estado === 'en_reparacion');
  return {
    totales: { costo, km, litros, combustible, mantenimiento: suma('mantenimiento'), viajes: Math.round(km / 850), fallas: 9 * k },
    por_categoria: categorias.map((c) => ({ categoria: c, monto: suma(c) })).filter((c) => c.monto > 0).sort((a, b) => b.monto - a.monto),
    por_mes: meses,
    por_unidad,
    por_chofer,
    fallas_por_sistema: [['frenos', 3], ['neumaticos', 2], ['luces', 2], ['electricidad', 1], ['motor', 1]].map(([sistema, n]) => ({ sistema, cantidad: Number(n) * k })),
    ahora: {
      unidades: unidades.length,
      en_servicio: unidades.filter((u) => u.estado === 'operativa').length,
      en_taller: unidades.filter((u) => u.estado === 'taller').length,
      en_viaje: db.viajes.filter((v) => v.estado === 'en_curso').length,
      fallas_abiertas: abiertas.length,
      fallas_criticas: abiertas.filter((f) => f.gravedad === 'critica').length,
      vencidos: db.documentos.filter((d) => d.vence < hoy).length,
      por_vencer: db.documentos.filter((d) => d.vence >= hoy && d.vence <= en30).length,
    },
  };
}
