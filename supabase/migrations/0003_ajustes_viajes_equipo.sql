-- Ajustes sobre la 0002, que ya está aplicada en la base publicada: una migración aplicada no se edita,
-- se corrige con la siguiente. Se ejecuta una sola vez, después de la 0002.

-- Nombre visible de cada integrante (se toma de la invitación o del chofer vinculado).
alter table public.miembros add column if not exists nombre text;

-- Inicia un viaje: exige el chequeo completo. Una falla crítica no deja salir y manda la unidad al taller.
-- Cambios: un remolque no inicia viajes, y el kilometraje del mensaje va con puntos de miles.
create or replace function public.iniciar_viaje(p_token text, p_km int, p_combustible smallint, p_items jsonb, p_destino text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u unidades;
  rol_txt text;
  mi_chofer uuid;
  faltan text[];
  item record;
  criticas int := 0;
  chequeo uuid;
  viaje uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into u from unidades where qr_token = upper(trim(p_token));
  if u.id is null then raise exception 'No encontramos la unidad'; end if;
  select m.rol::text, m.chofer_id into rol_txt, mi_chofer from miembros m where m.organizacion_id = u.organizacion_id and m.user_id = auth.uid();
  if rol_txt is null or rol_txt not in ('chofer', 'admin', 'jefe_taller') then raise exception 'No encontramos la unidad'; end if;
  if u.estado = 'baja' then raise exception 'La unidad está dada de baja'; end if;
  if u.estado = 'taller' then raise exception 'La unidad está en el taller. Consultá con el encargado antes de salir'; end if;
  if u.tipo in ('semirremolque', 'acoplado') then raise exception 'La unidad es un remolque: escaneá el QR del tractor o del camión para salir'; end if;
  if exists (select 1 from viajes where unidad_id = u.id and estado = 'en_curso') then raise exception 'La unidad ya está en viaje'; end if;
  if exists (select 1 from viajes where user_id = auth.uid() and estado = 'en_curso') then raise exception 'Ya tenés un viaje en curso. Terminalo antes de empezar otro'; end if;
  if p_km is null or p_km < 0 then raise exception 'Cargá el kilometraje del tablero'; end if;
  if u.km is not null and p_km < u.km then
    raise exception 'El kilometraje no puede ser menor al último registrado (% km)', replace(to_char(u.km, 'FM999,999,999'), ',', '.');
  end if;
  if p_combustible is null or p_combustible not between 0 and 100 then raise exception 'Indicá el nivel de combustible'; end if;

  -- Todos los puntos del chequeo que corresponden a este tipo de unidad tienen que estar respondidos.
  select array_agg(i.clave) into faltan from items_chequeo i
  where (i.solo_tipos is null or u.tipo = any (i.solo_tipos))
    and coalesce(p_items -> i.clave ->> 'estado', '') not in ('ok', 'problema');
  if faltan is not null then raise exception 'Falta revisar: %', array_to_string(faltan, ', '); end if;

  select count(*) into criticas from items_chequeo i
  where i.critico and (i.solo_tipos is null or u.tipo = any (i.solo_tipos)) and p_items -> i.clave ->> 'estado' = 'problema';

  insert into chequeos (organizacion_id, unidad_id, chofer_id, km, combustible, items, aprobado)
  values (u.organizacion_id, u.id, mi_chofer, p_km, p_combustible, p_items, criticas = 0)
  returning id into chequeo;

  for item in
    select i.clave, i.nombre, i.critico from items_chequeo i
    where (i.solo_tipos is null or u.tipo = any (i.solo_tipos)) and p_items -> i.clave ->> 'estado' = 'problema'
  loop
    insert into fallas (organizacion_id, unidad_id, sistema, descripcion, gravedad, fotos, origen, chequeo_id, chofer_id)
    values (u.organizacion_id, u.id, item.clave,
      coalesce(nullif(trim(p_items -> item.clave ->> 'nota'), ''), item.nombre),
      case when item.critico then 'critica' else 'moderada' end::gravedad_falla,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_items -> item.clave -> 'fotos', '[]'::jsonb)) x), '{}'),
      'chequeo', chequeo, mi_chofer);
  end loop;

  insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (u.organizacion_id, u.id, p_km, 'chequeo', auth.uid());

  if criticas > 0 then
    update unidades set estado = 'taller' where id = u.id;
    return jsonb_build_object('estado', 'bloqueado', 'chequeo_id', chequeo, 'fallas_criticas', criticas);
  end if;

  insert into viajes (organizacion_id, unidad_id, chofer_id, km_inicio, combustible_inicio, destino, chequeo_id)
  values (u.organizacion_id, u.id, mi_chofer, p_km, p_combustible, nullif(trim(p_destino), ''), chequeo)
  returning id into viaje;
  return jsonb_build_object('estado', 'iniciado', 'viaje_id', viaje, 'chequeo_id', chequeo);
end $$;

-- Cambio: el kilometraje del mensaje va con puntos de miles.
create or replace function public.terminar_viaje(p_viaje uuid, p_km int, p_combustible smallint, p_observaciones text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v viajes;
begin
  select * into v from viajes where id = p_viaje for update;
  if v.id is null or not (v.user_id = auth.uid() or public.es_gestor(v.organizacion_id)) then raise exception 'No encontramos el viaje'; end if;
  if v.estado <> 'en_curso' then raise exception 'El viaje ya terminó'; end if;
  if p_km is null or p_km < v.km_inicio then
    raise exception 'El kilometraje final no puede ser menor al de salida (% km)', replace(to_char(v.km_inicio, 'FM999,999,999'), ',', '.');
  end if;
  update viajes set estado = 'terminado', fin = now(), km_fin = p_km, combustible_fin = p_combustible,
    observaciones = nullif(trim(p_observaciones), '') where id = v.id;
  insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (v.organizacion_id, v.unidad_id, p_km, 'viaje', auth.uid());
end $$;

-- Una falla reportada por error: se descarta y, si era lo único que la frenaba, la unidad vuelve a servicio.
create or replace function public.descartar_falla(p_falla uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f fallas;
begin
  select * into f from fallas where id = p_falla for update;
  if f.id is null or not public.es_mecanico(f.organizacion_id) then raise exception 'No encontramos la falla'; end if;
  if f.estado not in ('abierta', 'en_reparacion') then return; end if;
  update fallas set estado = 'descartada', resuelta_en = now() where id = f.id;
  perform public.liberar_unidad_si_corresponde(f.unidad_id);
end $$;

-- Cambio: el nombre de la invitación (o del chofer vinculado) queda como nombre del integrante.
create or replace function public.aceptar_invitacion(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i invitaciones;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into i from invitaciones where token = p_token for update;
  if i.id is null or i.revocada then raise exception 'La invitación no es válida'; end if;
  if i.usada_en is not null then
    if i.usada_por = auth.uid() then return jsonb_build_object('organizacion_id', i.organizacion_id, 'rol', i.rol); end if;
    raise exception 'La invitación ya fue usada';
  end if;
  if i.vence < now() then raise exception 'La invitación venció. Pedí una nueva'; end if;
  -- Quien ya es miembro conserva su rol (un administrador que prueba un enlace de chofer no se degrada).
  insert into miembros (organizacion_id, user_id, rol, chofer_id, nombre)
  values (i.organizacion_id, auth.uid(), i.rol, i.chofer_id,
    coalesce(nullif(trim(i.nombre), ''), (select nombre from choferes where id = i.chofer_id)))
  on conflict (organizacion_id, user_id) do update set chofer_id = coalesce(miembros.chofer_id, excluded.chofer_id),
    nombre = coalesce(miembros.nombre, excluded.nombre);
  update invitaciones set usada_por = auth.uid(), usada_en = now() where id = i.id;
  return jsonb_build_object('organizacion_id', i.organizacion_id,
    'rol', (select rol from miembros where organizacion_id = i.organizacion_id and user_id = auth.uid()));
end $$;

-- ───────────── Permisos ─────────────
-- Como en la 0001: sin sesión no se toca ninguna tabla (Supabase da permisos a "anon" en cada tabla nueva).
revoke all on all tables in schema public from anon;
revoke execute on function public.descartar_falla(uuid) from public, anon;
grant execute on function public.descartar_falla(uuid) to authenticated;
-- Quien recibe una invitación ve empresa y rol antes de crear su cuenta (sólo con el enlace completo).
grant execute on function public.ver_invitacion(text) to anon;
