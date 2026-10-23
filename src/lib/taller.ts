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
