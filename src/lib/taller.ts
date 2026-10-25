// Nombres de las partes de la unidad: los del chequeo (tabla items_chequeo) más los que sólo aparecen en fallas.
export const NOMBRE_SISTEMA: Record<string, string> = {
  neumaticos: 'Neumáticos',
  frenos: 'Frenos y aire',
  luces: 'Luces',
  direccion: 'Dirección y suspensión',
  enganche: 'Enganche',
  niveles: 'Aceite y refrigerante',
  perdidas: 'Pérdidas',
  visibilidad: 'Espejos y parabrisas',
  seguridad: 'Matafuego y balizas',
  tacografo: 'Tacógrafo',
  documentacion: 'Documentación',
  motor: 'Motor',
  electricidad: 'Electricidad',
  carroceria: 'Carrocería',
  otro: 'Otro',
};

export const SISTEMAS_FALLA = ['motor', 'frenos', 'neumaticos', 'luces', 'electricidad', 'direccion', 'perdidas', 'enganche', 'carroceria', 'otro'].map((clave) => ({
  clave,
  nombre: NOMBRE_SISTEMA[clave],
}));

export const nombreSistema = (clave: string) => NOMBRE_SISTEMA[clave] ?? clave;

export const GRAVEDAD = {
  critica: { texto: 'Crítica', tono: 'crit' },
  moderada: { texto: 'Moderada', tono: 'warn' },
  leve: { texto: 'Leve', tono: 'neutro' },
} as const;

// Falla cargada desde la oficina: qué parte, qué pasa y qué tan grave. Las fotos se validan aparte (rutasValidas).
export function leerFalla(form: FormData, hayFotos = false): { datos?: { sistema: string; descripcion: string | null; gravedad: keyof typeof GRAVEDAD }; errores: Record<string, string> } {
  const texto = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
  const sistema = texto(form.get('sistema'));
  const descripcion = texto(form.get('descripcion')).slice(0, 500);
  const gravedad = texto(form.get('gravedad'));
  const errores: Record<string, string> = {};
  if (!SISTEMAS_FALLA.some((s) => s.clave === sistema)) errores.sistema = 'Elegí qué parte de la unidad falla.';
  if (!descripcion && !hayFotos) errores.descripcion = 'Contá qué pasa o agregá una foto.';
  if (!Object.hasOwn(GRAVEDAD, gravedad)) errores.gravedad = 'Indicá qué tan grave es.';
  if (Object.keys(errores).length) return { errores };
  return { errores, datos: { sistema, descripcion: descripcion || null, gravedad: gravedad as keyof typeof GRAVEDAD } };
}
