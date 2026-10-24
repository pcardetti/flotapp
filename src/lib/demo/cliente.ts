import { randomUUID } from 'node:crypto';
import { enGrupo } from '@/lib/permisos';
import { dia, EMAIL_DEMO, hace, itemsDe, ORG, sembrar, tablero, ultimosIngresos, YO, type Db, type Fila } from './datos';

// Cliente de Supabase de mentira para el modo demo: entiende las consultas que hace la app (filtros, orden,
// relaciones embebidas como "unidad:unidades(dominio)") y las funciones de la base que usa cada pantalla.
// Los datos viven en memoria mientras corre el servidor de desarrollo.

const VERSION = 2;
const global = globalThis as unknown as { __flotappDemo?: { version: number; db: Db } };
function base(): Db {
  if (global.__flotappDemo?.version !== VERSION) global.__flotappDemo = { version: VERSION, db: sembrar() };
  return global.__flotappDemo.db;
}

const ROLES = ['admin', 'jefe_taller', 'mecanico', 'chofer', 'lectura'];
type Resultado = { data: unknown; error: { message: string; code: string } | null; count?: number | null };
const falla = (message: string, code = 'P0001'): Resultado => ({ data: null, error: { message, code } });

// Columna que apunta a cada tabla: sirve para resolver las relaciones embebidas en los dos sentidos.
const CLAVE: Record<string, string> = {
  unidades: 'unidad_id', choferes: 'chofer_id', chequeos: 'chequeo_id', organizaciones: 'organizacion_id',
  tipos_documento: 'tipo_documento_id', viajes: 'viaje_id', ordenes: 'orden_id', fallas: 'falla_id',
};
const RANGO: Record<string, Record<string, number>> = { gravedad: { leve: 0, moderada: 1, critica: 2 } };

function partes(select: string) {
  const salida: string[] = [];
  let nivel = 0, actual = '';
  for (const c of select) {
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (c === ',' && nivel === 0) { salida.push(actual.trim()); actual = ''; } else actual += c;
  }
  if (actual.trim()) salida.push(actual.trim());
  return salida;
}

function embeber(db: Db, tabla: string, filas: Fila[], select: string): Fila[] {
  const relaciones = partes(select).map((p) => /^(?:(\w+):)?(\w+)(?:!\w+)?\(([\s\S]*)\)$/.exec(p)).filter((m) => m !== null);
  return filas.map((f) => {
    const copia: Fila = { ...f };
    for (const [, alias, otra, interior] of relaciones) {
      const clave = CLAVE[otra];
      if (clave && clave in f) {
        const rel = (db[otra] ?? []).find((x) => x.id === f[clave]);
        copia[alias ?? otra] = rel ? embeber(db, otra, [rel], interior)[0] : null;
      } else {
        const inversa = CLAVE[tabla];
        copia[alias ?? otra] = embeber(db, otra, (db[otra] ?? []).filter((x) => inversa && x[inversa] === f.id), interior);
      }
    }
    return copia;
  });
}

const igual = (a: unknown, b: unknown) => a === b || (a != null && b != null && String(a) === String(b));
const comparar = (col: string, a: unknown, b: unknown) => {
  const r = RANGO[col];
  const x = r ? r[String(a)] : a, y = r ? r[String(b)] : b;
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return x < y ? -1 : x > y ? 1 : 0;
};

class Consulta implements PromiseLike<Resultado> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private seleccion = '*';
  private filtros: ((f: Fila) => boolean)[] = [];
  private orden: [string, boolean][] = [];
  private desde = 0;
  private limite?: number;
  private modo: 'lista' | 'uno' | 'quizas' = 'lista';
  private devolver = false;
  private contar = false;
  private soloCuenta = false;
  private valores: Fila | Fila[] = {};

  constructor(private db: Db, private tabla: string, private rol: string) {}

  select(columnas = '*', opciones?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.seleccion = columnas;
    else this.devolver = true;
    this.contar = Boolean(opciones?.count);
    this.soloCuenta = Boolean(opciones?.head);
    return this;
  }
  insert(v: Fila | Fila[]) { this.op = 'insert'; this.valores = v; return this; }
  upsert(v: Fila | Fila[]) { return this.insert(v); }
  update(v: Fila) { this.op = 'update'; this.valores = v; return this; }
  delete() { this.op = 'delete'; return this; }

  private filtro(f: (fila: Fila) => boolean) { this.filtros.push(f); return this; }
  eq(c: string, v: unknown) { return this.filtro((f) => igual(f[c], v)); }
  neq(c: string, v: unknown) { return this.filtro((f) => !igual(f[c], v)); }
  gt(c: string, v: unknown) { return this.filtro((f) => f[c] != null && comparar(c, f[c], v) > 0); }
  gte(c: string, v: unknown) { return this.filtro((f) => f[c] != null && comparar(c, f[c], v) >= 0); }
  lt(c: string, v: unknown) { return this.filtro((f) => f[c] != null && comparar(c, f[c], v) < 0); }
  lte(c: string, v: unknown) { return this.filtro((f) => f[c] != null && comparar(c, f[c], v) <= 0); }
  in(c: string, vs: unknown[]) { return this.filtro((f) => vs.some((v) => igual(f[c], v))); }
  is(c: string, v: unknown) { return this.filtro((f) => (f[c] ?? null) === v); }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') return this.filtro((f) => (f[c] ?? null) !== v);
    return this.filtro((f) => !igual(f[c], v));
  }
  match(o: Fila) { Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
  or() { return this; }
  ilike(c: string, patron: string) {
    const re = new RegExp(`^${patron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
    return this.filtro((f) => re.test(String(f[c] ?? '')));
  }
  order(c: string, o?: { ascending?: boolean }) { this.orden.push([c, o?.ascending ?? true]); return this; }
  limit(n: number) { this.limite = n; return this; }
  range(desde: number, hasta: number) { this.desde = desde; this.limite = hasta - desde + 1; return this; }
  single() { this.modo = 'uno'; return this; }
  maybeSingle() { this.modo = 'quizas'; return this; }
  abortSignal() { return this; }
  returns() { return this; }

  private filas() {
    // El rol de la persona demo se elige con la cookie demo_rol.
    const todas = (this.db[this.tabla] ??= []).map((f) => (this.tabla === 'miembros' && f.user_id === YO ? { ...f, rol: this.rol } : f));
    return todas.filter((f) => this.filtros.every((filtro) => filtro(f)));
  }

  private ejecutar(): Resultado {
    const salida = (filas: Fila[]): Resultado => {
      if (this.modo === 'lista') return { data: filas, error: null, count: this.contar ? filas.length : null };
      if (filas.length > 1 || (this.modo === 'uno' && !filas.length)) return falla('JSON object requested, multiple (or no) rows returned', 'PGRST116');
      return { data: filas[0] ?? null, error: null };
    };
    const tabla = (this.db[this.tabla] ??= []);

    if (this.op === 'insert') {
      const nuevas = (Array.isArray(this.valores) ? this.valores : [this.valores]).map((v) => ({ ...valoresPorDefecto(this.tabla), ...v }));
      tabla.push(...nuevas);
      return this.devolver ? salida(nuevas) : { data: null, error: null };
    }
    // Las filas de miembros no tienen id: se reconocen por empresa y persona.
    const misma = (x: Fila, f: Fila) => (x.id != null ? x.id === f.id : x.user_id === f.user_id && x.organizacion_id === f.organizacion_id);
    if (this.op === 'update') {
      const cambiadas = this.filas().map((f) => Object.assign(tabla.find((x) => misma(x, f)) ?? f, this.valores));
      return this.devolver ? salida(cambiadas) : { data: null, error: null };
    }
    if (this.op === 'delete') {
      const borrar = this.filas();
      this.db[this.tabla] = tabla.filter((x) => !borrar.some((f) => misma(x, f)));
      return this.devolver ? salida(borrar) : { data: null, error: null };
    }

    let filas = this.filas();
    if (this.orden.length) {
      filas = [...filas].sort((a, b) => {
        for (const [c, asc] of this.orden) {
          const r = comparar(c, a[c], b[c]);
          if (r) return asc ? r : -r;
        }
        return 0;
      });
    }
    const total = filas.length;
    filas = filas.slice(this.desde, this.limite === undefined ? undefined : this.desde + this.limite);
    if (this.soloCuenta) return { data: null, error: null, count: total };
    const resultado = salida(embeber(this.db, this.tabla, filas, this.seleccion));
    return this.contar ? { ...resultado, count: total } : resultado;
  }

  then<A = Resultado, B = never>(ok?: ((r: Resultado) => A | PromiseLike<A>) | null, mal?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return new Promise<Resultado>((resolver) => resolver(this.ejecutar())).then(ok, mal);
  }
}

function valoresPorDefecto(tabla: string): Fila {
  const comunes = { id: randomUUID(), organizacion_id: ORG, creado_en: new Date().toISOString() };
  if (tabla === 'gastos') return { ...comunes, fecha: dia(), litros: null, foto: null, descripcion: null, cargado_por: YO };
  if (tabla === 'fallas') return { ...comunes, estado: 'abierta', fotos: [], creada_en: new Date().toISOString(), reportada_por: YO, orden_id: null };
  if (tabla === 'invitaciones') return { ...comunes, token: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''), vence: hace(-24 * 7), creada_en: comunes.creado_en, usada_en: null, revocada: false };
  if (tabla === 'unidades') return { ...comunes, estado: 'operativa', qr_token: randomUUID().replace(/[^A-HJ-NP-Z2-9]/gi, '').toUpperCase().slice(0, 8) };
  if (tabla === 'documentos') return { ...comunes, foto: null, numero: null, unidad_id: null, chofer_id: null };
  return comunes;
}

// ───────── Funciones de la base ─────────

const kmLegible = (n: number) => n.toLocaleString('es-AR');
const ahora = () => new Date().toISOString();

function liberar(db: Db, unidadId: string) {
  const u = db.unidades.find((x) => x.id === unidadId);
  if (!u || u.estado !== 'taller') return;
  const criticas = db.fallas.some((f) => f.unidad_id === u.id && f.gravedad === 'critica' && ['abierta', 'en_reparacion'].includes(f.estado));
  const parada = db.ordenes.some((o) => o.unidad_id === u.id && o.estado !== 'cerrada' && o.deja_fuera_servicio);
  if (!criticas && !parada) u.estado = 'operativa';
}

function registrarKm(db: Db, u: Fila, km: number | null, origen: string) {
  if (km == null || (u.km != null && km < u.km)) return;
  u.km = km;
  db.lecturas_km.push({ id: randomUUID(), organizacion_id: ORG, unidad_id: u.id, km, fecha: dia(), origen, creado_en: ahora(), user_id: YO });
}

function fichaQr(db: Db, rol: string, token: string) {
  const u = db.unidades.find((x) => x.qr_token === String(token).trim().toUpperCase());
  if (!u) return null;
  const v = db.viajes.find((x) => x.unidad_id === u.id && x.estado === 'en_curso');
  return {
    unidad: { id: u.id, organizacion_id: u.organizacion_id, dominio: u.dominio, tipo: u.tipo, marca: u.marca, modelo: u.modelo, km: u.km, estado: u.estado },
    empresa: db.organizaciones[0].nombre,
    mi_rol: rol,
    viaje_en_curso: v ? { id: v.id, mio: v.user_id === YO, inicio: v.inicio, chofer: db.choferes.find((c) => c.id === v.chofer_id)?.nombre ?? null } : null,
    fallas_abiertas: db.fallas.filter((f) => f.unidad_id === u.id && ['abierta', 'en_reparacion'].includes(f.estado)).length,
    items: itemsDe(u.tipo).map(({ clave, nombre, ayuda, critico }) => ({ clave, nombre, ayuda, critico })),
  };
}

function rpc(db: Db, rol: string, nombre: string, a: Fila): Resultado {
  const yo = db.miembros.find((m) => m.user_id === YO);
  const unidad = (unidadId: string) => db.unidades.find((u) => u.id === unidadId);
  const esTaller = enGrupo('taller', rol);

  switch (nombre) {
    case 'ficha_qr':
      return { data: fichaQr(db, rol, a.p_token), error: null };

    case 'iniciar_viaje': {
      const u = db.unidades.find((x) => x.qr_token === String(a.p_token).trim().toUpperCase());
      if (!u || !enGrupo('conduccion', rol)) return falla('No encontramos la unidad');
      if (u.estado === 'baja') return falla('La unidad está dada de baja');
      if (u.estado === 'taller') return falla('La unidad está en el taller. Consultá con el encargado antes de salir');
      if (!['tractor', 'chasis'].includes(u.tipo)) return falla('La unidad es un remolque: escaneá el QR del tractor o del camión para salir');
      if (db.viajes.some((v) => v.unidad_id === u.id && v.estado === 'en_curso')) return falla('La unidad ya está en viaje');
      if (db.viajes.some((v) => v.user_id === YO && v.estado === 'en_curso')) return falla('Ya tenés un viaje en curso. Terminalo antes de empezar otro');
      if (u.km != null && a.p_km < u.km) return falla(`El kilometraje no puede ser menor al último registrado (${kmLegible(u.km)} km)`);
      const items = itemsDe(u.tipo);
      const faltan = items.filter((i) => !['ok', 'problema'].includes(a.p_items?.[i.clave]?.estado));
      if (faltan.length) return falla(`Falta revisar: ${faltan.map((i) => i.clave).join(', ')}`);
      const problemas = items.filter((i) => a.p_items[i.clave].estado === 'problema');
      const criticas = problemas.filter((i) => i.critico).length;
      const chequeo = { id: randomUUID(), organizacion_id: ORG, unidad_id: u.id, chofer_id: yo?.chofer_id ?? null, user_id: YO, fecha: ahora(), km: a.p_km, combustible: a.p_combustible, items: a.p_items, aprobado: criticas === 0 };
      db.chequeos.push(chequeo);
      for (const i of problemas) {
        db.fallas.push({
          ...valoresPorDefecto('fallas'), unidad_id: u.id, sistema: i.clave, descripcion: a.p_items[i.clave].nota?.trim() || i.nombre,
          gravedad: i.critico ? 'critica' : 'moderada', fotos: a.p_items[i.clave].fotos ?? [], origen: 'chequeo', chequeo_id: chequeo.id, viaje_id: null, chofer_id: yo?.chofer_id ?? null,
        });
      }
      registrarKm(db, u, a.p_km, 'chequeo');
      if (criticas) {
        u.estado = 'taller';
        return { data: { estado: 'bloqueado', chequeo_id: chequeo.id, fallas_criticas: criticas }, error: null };
      }
      const viaje = {
        id: randomUUID(), organizacion_id: ORG, unidad_id: u.id, chofer_id: yo?.chofer_id ?? null, user_id: YO, estado: 'en_curso', inicio: ahora(), fin: null,
        km_inicio: a.p_km, km_fin: null, combustible_inicio: a.p_combustible, combustible_fin: null, destino: a.p_destino?.trim() || null, chequeo_id: chequeo.id, observaciones: null,
      };
      db.viajes.push(viaje);
      return { data: { estado: 'iniciado', viaje_id: viaje.id, chequeo_id: chequeo.id }, error: null };
    }

    case 'terminar_viaje': {
      const v = db.viajes.find((x) => x.id === a.p_viaje);
      if (!v) return falla('No encontramos el viaje');
      if (v.estado !== 'en_curso') return falla('El viaje ya terminó');
      if (a.p_km < v.km_inicio) return falla(`El kilometraje final no puede ser menor al de salida (${kmLegible(v.km_inicio)} km)`);
      Object.assign(v, { estado: 'terminado', fin: ahora(), km_fin: a.p_km, combustible_fin: a.p_combustible, observaciones: a.p_observaciones?.trim() || null });
      const u = unidad(v.unidad_id);
      if (u) registrarKm(db, u, a.p_km, 'viaje');
      return { data: null, error: null };
    }

    case 'registrar_trabajo':
    case 'abrir_orden': {
      const u = unidad(a.p_unidad);
      if (!u || !esTaller) return falla('No encontramos la unidad');
      const cerrada = nombre === 'registrar_trabajo';
      const orden = {
        id: randomUUID(), organizacion_id: ORG, unidad_id: u.id, numero: Math.max(0, ...db.ordenes.map((o) => o.numero)) + 1, tipo: a.p_tipo, descripcion: a.p_descripcion,
        trabajo: a.p_trabajo || null, estado: cerrada ? 'cerrada' : 'abierta', fecha_ingreso: dia(), fecha_egreso: cerrada ? dia() : null,
        deja_fuera_servicio: !cerrada && Boolean(a.p_deja_fuera_servicio), repuestos: a.p_repuestos ?? 0, mano_obra: a.p_mano_obra ?? 0, fotos: a.p_fotos ?? [], proveedor_id: null, creado_en: ahora(),
      };
      db.ordenes.push(orden);
      for (const f of db.fallas.filter((x) => (a.p_fallas ?? []).includes(x.id) && x.unidad_id === u.id)) Object.assign(f, { estado: cerrada ? 'resuelta' : 'en_reparacion', orden_id: orden.id });
      if (orden.deja_fuera_servicio) u.estado = 'taller';
      if (cerrada) registrarKm(db, u, a.p_km, 'taller');
      liberar(db, u.id);
      return { data: orden.id, error: null };
    }

    case 'cerrar_orden': {
      const o = db.ordenes.find((x) => x.id === a.p_orden);
      if (!o || !esTaller) return falla('Orden no encontrada');
      Object.assign(o, { estado: 'cerrada', trabajo: a.p_trabajo, fotos: a.p_fotos ?? [], repuestos: a.p_repuestos ?? 0, mano_obra: a.p_mano_obra ?? 0, fecha_egreso: dia() });
      for (const f of db.fallas.filter((x) => x.orden_id === o.id && x.estado !== 'descartada')) f.estado = 'resuelta';
      const u = unidad(o.unidad_id);
      if (u) registrarKm(db, u, a.p_km, 'taller');
      liberar(db, o.unidad_id);
      return { data: null, error: null };
    }

    case 'descartar_falla': {
      const f = db.fallas.find((x) => x.id === a.p_falla);
      if (!f || !esTaller) return falla('No encontramos la falla');
      f.estado = 'descartada';
      liberar(db, f.unidad_id);
      return { data: null, error: null };
    }

    case 'tablero':
      if (!enGrupo('gerencia', rol)) return falla('Sin acceso al tablero');
      return { data: tablero(db, a.p_desde, a.p_hasta), error: null };

    case 'ver_invitacion': {
      const i = db.invitaciones.find((x) => x.token === a.p_token);
      if (!i) return { data: null, error: null };
      const estado = i.revocada ? 'revocada' : i.usada_en ? 'usada' : i.vence < ahora() ? 'vencida' : 'vigente';
      return { data: { empresa: db.organizaciones[0].nombre, tipo: 'flota', rol: i.rol, nombre: i.nombre, estado }, error: null };
    }

    case 'aceptar_invitacion': {
      const i = db.invitaciones.find((x) => x.token === a.p_token);
      if (!i) return falla('La invitación no existe');
      Object.assign(i, { usada_en: ahora(), usada_por: YO });
      return { data: { organizacion_id: ORG, rol: rol === 'admin' ? 'admin' : i.rol }, error: null };
    }

    case 'crear_organizacion':
      return { data: ORG, error: null };

    case 'consumir_intento':
      return { data: true, error: null };

    case 'solicitar_contratacion': {
      const solicitudes = (db.solicitudes ??= []);
      solicitudes.push({ id: solicitudes.length + 1, empresa: a.p_empresa, nombre: a.p_nombre, email: a.p_email, telefono: a.p_telefono, unidades: a.p_unidades, plan: a.p_plan, comentario: a.p_comentario, estado: 'nueva', creada_en: new Date().toISOString() });
      return { data: solicitudes.length, error: null };
    }

    case 'auditar_denegado': {
      const yoMiembro = db.miembros.find((m) => m.user_id === YO);
      db.auditoria.push({
        id: Math.max(0, ...db.auditoria.map((e) => e.id)) + 1, organizacion_id: ORG, user_id: YO, quien: yoMiembro?.nombre ?? EMAIL_DEMO, rol,
        accion: 'permiso.denegado', categoria: 'seguridad', recurso: 'app', recurso_id: null, detalle: { que: a.p_que }, ip: '127.0.0.1', agente: null, creado_en: ahora(),
      });
      return { data: null, error: null };
    }

    case 'ultimos_ingresos':
      return { data: rol === 'admin' ? ultimosIngresos() : [], error: null };

    default:
      return falla(`La función ${nombre} no está en el modo demo`, 'PGRST202');
  }
}

// ───────── Fotos de ejemplo ─────────

// Cada ruta tiene su "foto": un degradé con un ícono de cámara, para ver cómo quedan las miniaturas.
function fotoDemo(ruta: string) {
  const tono = [...ruta].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${tono} 25% 38%)"/><stop offset="1" stop-color="hsl(${(tono + 40) % 360} 30% 18%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="10" stroke-linejoin="round"><rect x="140" y="110" width="120" height="86" rx="14"/><circle cx="200" cy="153" r="24"/><path d="M172 110l10-16h36l10 16"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function clienteDemo(rolCookie: string | undefined) {
  const rol = ROLES.includes(rolCookie ?? '') ? (rolCookie as string) : 'admin';
  const db = base();
  const claims = { sub: YO, email: EMAIL_DEMO };
  return {
    from: (tabla: string) => new Consulta(db, tabla, rol),
    rpc: (nombre: string, args: Fila = {}) => Promise.resolve(rpc(db, rol, nombre, args)),
    auth: {
      getClaims: async () => ({ data: { claims }, error: null }),
      getUser: async () => ({ data: { user: { id: YO, email: EMAIL_DEMO } }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: { id: YO }, session: {} }, error: null }),
      signUp: async () => ({ data: { user: { id: YO }, session: {} }, error: null }),
      resend: async () => ({ data: {}, error: null }),
      exchangeCodeForSession: async () => ({ data: {}, error: null }),
      verifyOtp: async () => ({ data: {}, error: null }),
    },
    storage: {
      from: () => ({
        createSignedUrls: async (rutas: string[]) => ({ data: rutas.map((path) => ({ path, signedUrl: fotoDemo(path), error: null })), error: null }),
        createSignedUrl: async (ruta: string) => ({ data: { signedUrl: fotoDemo(ruta) }, error: null }),
        // La "subida" va a una ruta local que sólo existe en el modo demo.
        createSignedUploadUrl: async (ruta: string) => ({ data: { signedUrl: '/api/demo/subida', token: 'demo', path: ruta }, error: null }),
        upload: async (ruta: string) => ({ data: { path: ruta }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
}
