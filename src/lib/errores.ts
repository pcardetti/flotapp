// Las reglas de la base levantan errores ya escritos para la persona (P0001): modo consulta, tope de unidades
// del plan, el último administrador… Esos se muestran tal cual; cualquier otro, con el mensaje genérico.
export const mensajeDe = (error: { code?: string; message: string } | null | undefined, generico: string) =>
  error?.code === 'P0001' ? error.message : generico;
