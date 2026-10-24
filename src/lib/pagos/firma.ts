import { createHmac, timingSafeEqual } from 'node:crypto';

// Firma de los avisos (webhooks) de Mercado Pago. La cabecera x-signature trae "ts=…,v1=…"; v1 es un HMAC-SHA256,
// con la clave secreta de los webhooks, de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (se omite cada parte
// que no venga). La documentación pide el data.id alfanumérico en minúsculas y los SDK oficiales lo usan tal como
// llega: vale cualquiera de los dos. Sin firma válida, el aviso se descarta.
export function firmaValida(firma: string | null, idPedido: string | null, idRecurso: string | null, secreto: string) {
  if (!firma || !secreto) return false;
  const partes = new Map(firma.split(',').map((p) => {
    const [clave, ...valor] = p.trim().split('=');
    return [clave.trim(), valor.join('=').trim()] as const;
  }));
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return false;
  const ids = new Set([idRecurso && /^[a-z0-9]+$/i.test(idRecurso) ? idRecurso.toLowerCase() : idRecurso, idRecurso]);
  return [...ids].some((id) => {
    const manifiesto = `${id ? `id:${id};` : ''}${idPedido ? `request-id:${idPedido};` : ''}ts:${ts};`;
    const esperada = createHmac('sha256', secreto).update(manifiesto).digest('hex');
    return esperada.length === v1.length && timingSafeEqual(Buffer.from(esperada), Buffer.from(v1));
  });
}
