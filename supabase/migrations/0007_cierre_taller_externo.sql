-- Cuando el taller externo cierra una orden que le derivaron, pasa lo mismo que cuando la cierra el taller propio:
-- las fallas que atendía quedan resueltas y la unidad vuelve a servicio si nada más la frena. Antes quedaba "en taller"
-- con la falla "en reparación" hasta que alguien de la flota la liberaba.
-- Se ejecuta una sola vez, después de la 0006.

-- Lo que sigue a cerrar cualquier orden (sólo lo usan las funciones de la base).
create function public.terminar_orden(p_orden uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_unidad uuid;
begin
  select unidad_id into v_unidad from ordenes where id = p_orden and estado = 'cerrada';
  if v_unidad is null then return; end if;
  update fallas set estado = 'resuelta', resuelta_en = now() where orden_id = p_orden and estado in ('abierta', 'en_reparacion');
  perform public.liberar_unidad_si_corresponde(v_unidad);
end $$;

-- Lado del taller externo: informa avance y costos de las órdenes derivadas a él, y las cierra.
-- Cambios: al cerrar anota quién la cerró, la fecha de egreso no queda antes de la de ingreso y se termina la orden.
create or replace function public.taller_actualizar_orden(p_orden uuid, p_estado public.estado_orden, p_repuestos numeric,
  p_mano_obra numeric, p_nota text, p_fecha_egreso date default null)
returns void language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  select * into o from ordenes where id = p_orden for update;
  if o.id is null or o.proveedor_id is null or not es_miembro(o.proveedor_id)
     or not vinculo_activo(o.organizacion_id, o.proveedor_id) then
    raise exception 'Orden no encontrada';
  end if;
  if o.estado = 'cerrada' then raise exception 'La orden ya está cerrada'; end if;
  update ordenes set estado = p_estado, repuestos = coalesce(p_repuestos, repuestos), mano_obra = coalesce(p_mano_obra, mano_obra),
    nota = coalesce(p_nota, nota),
    fecha_egreso = case when p_estado = 'cerrada' then greatest(coalesce(p_fecha_egreso, current_date), o.fecha_ingreso) end,
    cerrada_por = case when p_estado = 'cerrada' then auth.uid() end
  where id = o.id;
  if p_estado = 'cerrada' then perform public.terminar_orden(o.id); end if;
end $$;

-- Lado del taller propio: cierra una orden larga. Cambio: lo que sigue al cierre lo hace terminar_orden.
create or replace function public.cerrar_orden(p_orden uuid, p_trabajo text, p_fotos text[] default '{}', p_repuestos numeric default 0,
  p_mano_obra numeric default 0, p_km int default null)
returns void language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  select * into o from ordenes where id = p_orden for update;
  if o.id is null or not public.es_mecanico(o.organizacion_id) then raise exception 'No encontramos la orden'; end if;
  if o.estado = 'cerrada' then raise exception 'La orden ya está cerrada'; end if;
  update ordenes set estado = 'cerrada', fecha_egreso = greatest(current_date, fecha_ingreso), nota = nullif(trim(p_trabajo), ''),
    fotos = fotos || coalesce(p_fotos, '{}'), repuestos = coalesce(p_repuestos, 0), mano_obra = coalesce(p_mano_obra, 0),
    km = coalesce(p_km, km), cerrada_por = auth.uid()
  where id = o.id;
  if p_km is not null then
    insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (o.organizacion_id, o.unidad_id, p_km, 'taller', auth.uid());
  end if;
  perform public.terminar_orden(o.id);
end $$;

-- ───────────── Permisos ─────────────
revoke execute on function public.terminar_orden(uuid) from public, anon, authenticated;
