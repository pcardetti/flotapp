'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { TipoOrganizacion } from '@/lib/empresa';

export type EstadoAlta = { error?: string; nombre?: string; tipo?: TipoOrganizacion };

const TIPOS: TipoOrganizacion[] = ['flota', 'taller', 'recapadora'];

export async function crearEmpresa(_: EstadoAlta, form: FormData): Promise<EstadoAlta> {
  const nombre = String(form.get('nombre') ?? '').trim();
  const tipo = String(form.get('tipo') ?? '') as TipoOrganizacion;
  if (!nombre) return { error: 'Escribí el nombre de la empresa.', tipo };
  if (!TIPOS.includes(tipo)) return { error: 'Elegí qué tipo de empresa es.', nombre };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('crear_organizacion', { p_nombre: nombre, p_tipo: tipo });
  if (error || !data) return { error: 'No pudimos crear la empresa. Probá de nuevo en unos segundos.', nombre, tipo };
  redirect(`/empresa/${data}/panel`);
}
