// Reglas de la flota sin dependencias de Next ni de Supabase, para poder probarlas solas.

export type TipoUnidad = 'tractor' | 'chasis' | 'semirremolque' | 'acoplado';
export type EstadoUnidad = 'operativa' | 'taller' | 'baja';

export const TIPOS_UNIDAD: Record<TipoUnidad, string> = {
  tractor: 'Tractor',
  chasis: 'Camión chasis',
  semirremolque: 'Semirremolque',
  acoplado: 'Acoplado',
};

export const ESTADOS_UNIDAD: Record<EstadoUnidad, string> = {
  operativa: 'En servicio',
  taller: 'En taller',
  baja: 'De baja',
};

export const JURISDICCIONES = [
  'Nacional', 'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
  'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

// Los remolques no tienen odómetro propio: el kilometraje es opcional.
export const tieneMotor = (tipo: string) => tipo === 'tractor' || tipo === 'chasis';

// Una misma patente se guarda siempre igual, la escriban como la escriban: "af123kd" y "AF-123 KD" son "AF 123 KD".
export function normalizarDominio(texto: string) {
  const compacto = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(compacto)) return `${compacto.slice(0, 2)} ${compacto.slice(2, 5)} ${compacto.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(compacto)) return `${compacto.slice(0, 3)} ${compacto.slice(3)}`;
  return texto.toUpperCase().trim().replace(/[\s-]+/g, ' ');
}

export type DatosUnidad = {
  dominio: string;
  tipo: TipoUnidad;
  marca: string;
  modelo: string;
  anio: number | null;
  km: number | null;
  jurisdiccion: string;
  estado: EstadoUnidad;
  chofer_id: string | null;
  cargas_peligrosas: boolean;
};

export type Errores = Partial<Record<string, string>>;

const texto = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
// Acepta "412300", "412.300", "412 300" y "412.300 km". La coma no se acepta: en Argentina marca decimales.
const entero = (v: string) => {
  const limpio = v.toLowerCase().replace(/km\.?$/, '').replace(/[\s.]/g, '');
  return /^\d+$/.test(limpio) ? Number(limpio) : NaN;
};
const KM_INVALIDO = 'Escribí el kilometraje sólo con números, sin coma ni decimales (por ejemplo 412300 o 412.300).';

// Lee y valida el formulario de unidad. Devuelve los datos listos para guardar o los errores por campo.
export function leerUnidad(form: FormData, anioActual = new Date().getFullYear()): { datos?: DatosUnidad; errores: Errores } {
  const errores: Errores = {};
  const crudo = texto(form.get('dominio'));
  const dominio = normalizarDominio(crudo);
  if (!crudo) errores.dominio = 'Escribí la patente.';
  else if (!/^[A-Z0-9 ]{5,12}$/.test(dominio)) errores.dominio = 'La patente sólo puede tener letras y números (por ejemplo AF 123 KD).';

  const tipo = texto(form.get('tipo')) as TipoUnidad;
  if (!(tipo in TIPOS_UNIDAD)) errores.tipo = 'Elegí el tipo de unidad.';

  const marca = texto(form.get('marca'));
  const modelo = texto(form.get('modelo'));
  if (!marca) errores.marca = 'Escribí la marca.';
  if (!modelo) errores.modelo = 'Escribí el modelo.';

  const anioTxt = texto(form.get('anio'));
  const anio = anioTxt ? entero(anioTxt) : null;
  if (anio !== null && (Number.isNaN(anio) || anio < 1950 || anio > anioActual + 1)) errores.anio = `El año tiene que estar entre 1950 y ${anioActual + 1}.`;

  const kmTxt = texto(form.get('km'));
  const km = kmTxt ? entero(kmTxt) : null;
  if (km !== null && (Number.isNaN(km) || km > 5_000_000)) errores.km = KM_INVALIDO;
  else if (km === null && tieneMotor(tipo)) errores.km = 'Escribí el kilometraje del tablero.';

  const jurisdiccion = texto(form.get('jurisdiccion')) || 'Nacional';
  if (!JURISDICCIONES.includes(jurisdiccion)) errores.jurisdiccion = 'Elegí una jurisdicción de la lista.';

  const estado = (texto(form.get('estado')) || 'operativa') as EstadoUnidad;
  if (!(estado in ESTADOS_UNIDAD)) errores.estado = 'Elegí un estado de la lista.';

  const chofer = texto(form.get('chofer_id'));
  if (chofer && !/^[0-9a-f-]{36}$/i.test(chofer)) errores.chofer_id = 'Elegí un chofer de la lista.';

  if (Object.keys(errores).length) return { errores };
  return {
    errores,
    datos: { dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, chofer_id: chofer || null, cargas_peligrosas: form.get('cargas_peligrosas') === 'on' },
  };
}

export function leerChofer(form: FormData): { datos?: { nombre: string; telefono: string | null }; errores: Errores } {
  const errores: Errores = {};
  const nombre = texto(form.get('nombre')).replace(/\s+/g, ' ');
  const telefono = texto(form.get('telefono'));
  if (!nombre) errores.nombre = 'Escribí el nombre y apellido.';
  else if (nombre.length > 120) errores.nombre = 'El nombre es demasiado largo.';
  if (telefono && !/^[0-9+()\s-]{6,25}$/.test(telefono)) errores.telefono = 'El teléfono sólo puede tener números, espacios, guiones y +.';
  if (Object.keys(errores).length) return { errores };
  return { errores, datos: { nombre, telefono: telefono || null } };
}

export function leerKm(form: FormData, kmActual: number | null): { km?: number; errores: Errores } {
  const t = texto(form.get('km'));
  const km = t ? entero(t) : NaN;
  if (Number.isNaN(km) || km > 5_000_000) return { errores: { km: KM_INVALIDO } };
  if (kmActual !== null && km < kmActual)
    return { errores: { km: `No puede ser menor al último registrado (${kmActual.toLocaleString('es-AR')} km). Si hubo un error de carga, corregilo en Editar.` } };
  return { km, errores: {} };
}

// Traduce los errores de la base de datos a mensajes para la persona que está cargando.
export function mensajeDeError(error: { code?: string; message: string } | null) {
  if (!error) return null;
  if (error.code === '23505' && /dominio/.test(error.message)) return 'Ya hay una unidad con esa patente en tu flota.';
  if (error.code === '23503' && /chofer/.test(error.message)) return 'Ese chofer ya no existe. Recargá la página y elegilo de nuevo.';
  if (error.code === '23503') return 'No se puede eliminar: la unidad tiene órdenes de trabajo o neumáticos montados. Marcala como "De baja" para conservar su historia.';
  if (error.code === '42501' || /row-level security/i.test(error.message)) return 'Tu rol no permite hacer este cambio.';
  if (error.code === '23514') return 'Algún dato no es válido. Revisá los campos.';
  return 'No pudimos guardar los cambios. Probá de nuevo en unos segundos.';
}
