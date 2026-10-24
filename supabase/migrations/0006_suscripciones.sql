-- Suscripciones: planes, prueba gratis de 14 días, tope de unidades por plan y modo consulta cuando la prueba
-- o el pago vencen. Pagan sólo las flotas; talleres y recapadoras usan Flotapp gratis.
-- Se ejecuta una sola vez, después de la 0005.

-- ───────────── Planes ─────────────
-- La única lista de planes: la página de venta, el tope de unidades y los cobros salen de acá. Los precios se
-- cambian en Supabase → Table Editor → planes (pesos por período, sin IVA). El anual equivale a 10 meses.
create table public.planes (
  clave text primary key check (clave ~ '^[a-z0-9-]{2,30}$'),
  nombre text not null,
  max_unidades int check (max_unidades > 0), -- null: sin tope
  precio_mensual numeric(12, 2) check (precio_mensual > 0), -- null: a cotizar
  precio_anual numeric(12, 2) check (precio_anual > 0),
  bajada text not null default '',
  orden int not null default 0,
  publico boolean not null default true
);
insert into public.planes (clave, nombre, max_unidades, precio_mensual, precio_anual, bajada, orden) values
  ('inicial', 'Inicial', 5, 49000, 490000, 'Para ordenar una flota chica desde el primer día.', 1),
  ('flota', 'Flota', 15, 119000, 1190000, 'Para flotas que crecen y suman choferes y mecánicos.', 2),
  ('empresa', 'Empresa', 40, 259000, 2590000, 'Para operaciones grandes, con taller propio.', 3),
  ('a-medida', 'A medida', null, null, null, 'Más de 40 unidades: armamos un precio para tu operación.', 4);
alter table public.planes enable row level security;
create policy planes_leer on public.planes for select to anon, authenticated using (publico);

-- ───────────── Suscripción de cada flota ─────────────
create type public.estado_suscripcion as enum ('prueba', 'activa', 'pago_pendiente', 'cancelada', 'vencida');

create table public.suscripciones (
  organizacion_id uuid primary key references public.organizaciones on delete cascade,
  plan text not null references public.planes,
  estado public.estado_suscripcion not null default 'prueba',
  periodo text not null default 'mensual' check (periodo in ('mensual', 'anual')),
  precio numeric(12, 2), -- lo que se cobra cada período, fijado al contratar
  prueba_hasta timestamptz,
  periodo_hasta timestamptz, -- hasta cuándo está pago (null con estado activa: sin vencimiento, alta manual)
  gracia_hasta timestamptz, -- con un cobro rechazado, hasta cuándo se puede seguir cargando
  cancelar_al_terminar boolean not null default false,
  proveedor text check (proveedor in ('manual', 'mercadopago')), -- null: todavía en prueba
  proveedor_suscripcion text unique, -- la preaprobación de Mercado Pago
  pagador text,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table public.suscripciones enable row level security;

-- Cobros (aprobados, rechazados o devueltos), uno por pago de la pasarela.
create table public.pagos (
  id bigint generated always as identity primary key,
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  proveedor text not null,
  proveedor_pago text not null,
  estado text not null check (estado in ('aprobado', 'rechazado', 'pendiente', 'devuelto')),
  monto numeric(12, 2) not null,
  moneda text not null default 'ARS',
  fecha timestamptz not null default now(),
  detalle text,
  unique (proveedor, proveedor_pago)
);
create index on public.pagos (organizacion_id, fecha desc);
alter table public.pagos enable row level security;

-- Avisos de la pasarela, guardados una sola vez: un aviso repetido no se procesa dos veces.
create table public.eventos_pago (
  id bigint generated always as identity primary key,
  proveedor text not null,
  evento text not null,
  tipo text not null,
  recurso text,
  recibido_en timestamptz not null default now(),
  procesado_en timestamptz,
  error text,
  unique (proveedor, evento)
);
alter table public.eventos_pago enable row level security;

-- Secreto que comparten el servidor de la app y la base para anotar pagos (la app nunca usa la llave maestra).
-- Para verlo y cargarlo en Vercel como FLOTAPP_SECRETO_PAGOS: select valor from secretos where clave = 'pagos';
create table public.secretos (clave text primary key, valor text not null);
insert into public.secretos (clave, valor)
values ('pagos', encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'));
alter table public.secretos enable row level security;

-- Las flotas que ya existían siguen como hasta ahora: activas, sin tope ni vencimiento (alta manual).
insert into public.suscripciones (organizacion_id, plan, estado, proveedor)
select id, 'a-medida', 'activa', 'manual' from public.organizaciones where tipo = 'flota'
on conflict (organizacion_id) do nothing;

-- Cada flota nueva arranca con 14 días de prueba del plan Flota, sin tarjeta.
create function public.crear_suscripcion_de_prueba() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'flota' then
    insert into suscripciones (organizacion_id, plan, estado, prueba_hasta) values (new.id, 'flota', 'prueba', now() + interval '14 days');
  end if;
  return new;
end $$;
create trigger organizaciones_prueba after insert on public.organizaciones
  for each row execute function public.crear_suscripcion_de_prueba();

-- ───────────── Estado de la cuenta ─────────────
-- libre (talleres y recapadoras), prueba, activa, gracia (cobro rechazado, todavía se puede cargar) o
-- solo_lectura (se ve todo, no se carga nada). Un aviso de cobro que se demora tiene 3 días de tolerancia.
create function public.cuenta_de(p_org uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare v_tipo public.tipo_organizacion; s suscripciones;
begin
  select tipo into v_tipo from organizaciones where id = p_org;
  if v_tipo is distinct from 'flota' then return 'libre'; end if;
  select * into s from suscripciones where organizacion_id = p_org;
  if s.organizacion_id is null then return 'solo_lectura'; end if;
  return case s.estado
    when 'prueba' then case when s.prueba_hasta > now() then 'prueba' else 'solo_lectura' end
    when 'activa' then case when s.periodo_hasta is null or s.periodo_hasta + interval '3 days' > now() then 'activa' else 'solo_lectura' end
    when 'pago_pendiente' then case when s.gracia_hasta > now() then 'gracia' else 'solo_lectura' end
    when 'cancelada' then case when s.periodo_hasta > now() then 'activa' else 'solo_lectura' end
    else 'solo_lectura'
  end;
end $$;

-- Para las pantallas: el estado de una empresa de la que la persona es parte.
create function public.estado_cuenta(p_org uuid) returns text language sql stable security definer set search_path = public as $$
  select case when public.es_miembro(p_org) then public.cuenta_de(p_org) end;
$$;

-- Modo consulta: con la prueba o el pago vencidos, la base no deja cargar, cambiar ni borrar datos de la flota.
-- Borrar la empresa entera sí se puede.
create function public.exigir_cuenta_activa() returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid := case when tg_op = 'DELETE' then old.organizacion_id else new.organizacion_id end;
begin
  if public.cuenta_de(v_org) = 'solo_lectura' then
    raise exception 'La cuenta está en modo consulta porque terminó la prueba o hay un pago vencido. Se puede ver todo; para volver a cargar datos, activá un plan en Suscripción.'
      using errcode = 'P0001', hint = 'solo_lectura';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['chequeos', 'choferes', 'configuracion', 'documentos', 'fallas', 'gastos', 'invitaciones',
                           'lecturas_km', 'neumatico_eventos', 'neumaticos', 'ordenes', 'tareas_plan', 'tipos_documento', 'unidades', 'viajes'] loop
    execute format('create trigger cuenta_activa before insert or update or delete on public.%I for each row execute function public.exigir_cuenta_activa()', t);
  end loop;
end $$;

-- Tope de unidades en servicio según el plan (las de baja no cuentan). Bloquea la suscripción mientras cuenta,
-- así dos altas al mismo tiempo no pasan el tope.
create function public.controlar_cupo_unidades() returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int; v_nombre text; v_usadas int;
begin
  if new.estado = 'baja' or (tg_op = 'UPDATE' and old.estado <> 'baja') then return new; end if;
  select p.max_unidades, p.nombre into v_max, v_nombre
  from suscripciones s join planes p on p.clave = s.plan
  where s.organizacion_id = new.organizacion_id
  for update of s;
  if v_max is null then return new; end if;
  select count(*) into v_usadas from unidades where organizacion_id = new.organizacion_id and estado <> 'baja' and id <> new.id;
  if v_usadas >= v_max then
    raise exception 'Tu plan % permite hasta % unidades en servicio. Subí de plan para sumar más, o da de baja una que ya no uses.', v_nombre, v_max
      using errcode = 'P0001', hint = 'cupo_unidades';
  end if;
  return new;
end $$;
create trigger cupo_unidades before insert or update of estado on public.unidades
  for each row execute function public.controlar_cupo_unidades();

-- Pantalla Suscripción (sólo administradores): plan, estado, uso, fechas y últimos cobros.
create function public.mi_suscripcion(p_org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s suscripciones; p planes;
begin
  if not public.es_miembro(p_org, array['admin']::rol_miembro[]) then return null; end if;
  select * into s from suscripciones where organizacion_id = p_org;
  if s.organizacion_id is null then return null; end if;
  select * into p from planes where clave = s.plan;
  return jsonb_build_object(
    'plan', s.plan, 'nombre_plan', p.nombre, 'max_unidades', p.max_unidades,
    'unidades', (select count(*) from unidades where organizacion_id = p_org and estado <> 'baja'),
    'estado', s.estado, 'cuenta', public.cuenta_de(p_org), 'periodo', s.periodo, 'precio', s.precio,
    'prueba_hasta', s.prueba_hasta, 'periodo_hasta', s.periodo_hasta, 'gracia_hasta', s.gracia_hasta,
    'cancelar_al_terminar', s.cancelar_al_terminar, 'proveedor', s.proveedor, 'proveedor_suscripcion', s.proveedor_suscripcion,
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', g.fecha, 'monto', g.monto, 'estado', g.estado, 'detalle', g.detalle) order by g.fecha desc)
      from (select * from pagos where organizacion_id = p_org order by fecha desc limit 24) g
    ), '[]'::jsonb)
  );
end $$;

-- ───────────── Funciones del servidor de pagos ─────────────
-- Las llama el servidor de la app (avisos de Mercado Pago y cambios de plan) con el secreto de arriba.
create function public.pagos_autorizar(p_secreto text) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_secreto is null or p_secreto is distinct from (select valor from secretos where clave = 'pagos') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

-- Anota un aviso de la pasarela. Devuelve true si hay que procesarlo (es nuevo, o la vez anterior falló).
create function public.pagos_recibir_evento(p_secreto text, p_proveedor text, p_evento text, p_tipo text, p_recurso text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_procesado timestamptz;
begin
  perform public.pagos_autorizar(p_secreto);
  insert into eventos_pago (proveedor, evento, tipo, recurso) values (p_proveedor, p_evento, p_tipo, p_recurso)
  on conflict (proveedor, evento) do nothing;
  select procesado_en into v_procesado from eventos_pago where proveedor = p_proveedor and evento = p_evento;
  return v_procesado is null;
end $$;

create function public.pagos_cerrar_evento(p_secreto text, p_proveedor text, p_evento text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.pagos_autorizar(p_secreto);
  update eventos_pago set procesado_en = case when p_error is null then now() end, error = left(p_error, 500)
  where proveedor = p_proveedor and evento = p_evento;
end $$;

-- Alta, cambio de plan o baja según la pasarela. Sólo una suscripción que se activa reemplaza a la vigente: el aviso
-- de baja de otra (una reemplazada, o un pago abandonado) no cambia nada. Mientras la vigente sigue autorizada, un
-- cobro rechazado queda pendiente hasta que se apruebe otro. Devuelve la suscripción reemplazada, para darla de baja.
create function public.pagos_actualizar_suscripcion(
  p_secreto text, p_org uuid, p_plan text, p_periodo text, p_estado public.estado_suscripcion, p_precio numeric,
  p_proveedor text, p_proveedor_suscripcion text, p_periodo_hasta timestamptz, p_cancelar_al_terminar boolean, p_pagador text
) returns text language plpgsql security definer set search_path = public as $$
declare v suscripciones; v_estado public.estado_suscripcion := p_estado;
begin
  perform public.pagos_autorizar(p_secreto);
  if not exists (select 1 from organizaciones where id = p_org and tipo = 'flota') then
    raise exception 'No encontramos la flota';
  end if;
  select * into v from suscripciones where organizacion_id = p_org for update;
  if v.organizacion_id is not null and v.proveedor_suscripcion is distinct from p_proveedor_suscripcion then
    if p_estado <> 'activa' then return null; end if;
  elsif v.estado = 'pago_pendiente' and p_estado = 'activa' then
    v_estado := 'pago_pendiente';
  end if;
  insert into suscripciones as s (organizacion_id, plan, estado, periodo, precio, proveedor, proveedor_suscripcion, periodo_hasta, cancelar_al_terminar, pagador)
  values (p_org, p_plan, v_estado, p_periodo, p_precio, p_proveedor, p_proveedor_suscripcion, p_periodo_hasta, coalesce(p_cancelar_al_terminar, false), p_pagador)
  on conflict (organizacion_id) do update set
    plan = excluded.plan, estado = excluded.estado, periodo = excluded.periodo, precio = excluded.precio,
    proveedor = excluded.proveedor, proveedor_suscripcion = excluded.proveedor_suscripcion,
    periodo_hasta = coalesce(excluded.periodo_hasta, s.periodo_hasta),
    gracia_hasta = case when excluded.estado = 'pago_pendiente' then s.gracia_hasta end,
    cancelar_al_terminar = excluded.cancelar_al_terminar, pagador = coalesce(excluded.pagador, s.pagador), actualizada_en = now();
  return case when v.proveedor_suscripcion is distinct from p_proveedor_suscripcion then v.proveedor_suscripcion end;
end $$;

-- Un cobro: si se aprueba, extiende el período pago; si se rechaza, abre 7 días de gracia. Se anota siempre, pero sólo
-- los cobros de la suscripción vigente cambian el estado de la cuenta.
create function public.pagos_registrar_cobro(
  p_secreto text, p_org uuid, p_proveedor text, p_proveedor_pago text, p_proveedor_suscripcion text, p_estado text,
  p_monto numeric, p_fecha timestamptz, p_cubre_hasta timestamptz, p_detalle text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.pagos_autorizar(p_secreto);
  insert into pagos (organizacion_id, proveedor, proveedor_pago, estado, monto, fecha, detalle)
  values (p_org, p_proveedor, p_proveedor_pago, p_estado, p_monto, coalesce(p_fecha, now()), p_detalle)
  on conflict (proveedor, proveedor_pago) do update set estado = excluded.estado, monto = excluded.monto, detalle = excluded.detalle;
  if p_estado = 'aprobado' then
    update suscripciones set
      estado = case when estado = 'cancelada' then estado else 'activa' end,
      periodo_hasta = greatest(coalesce(periodo_hasta, p_cubre_hasta), p_cubre_hasta),
      gracia_hasta = null, actualizada_en = now()
    where organizacion_id = p_org and proveedor_suscripcion is not distinct from p_proveedor_suscripcion;
  elsif p_estado = 'rechazado' then
    update suscripciones set estado = 'pago_pendiente', gracia_hasta = coalesce(gracia_hasta, now() + interval '7 days'), actualizada_en = now()
    where organizacion_id = p_org and estado in ('activa', 'pago_pendiente') and proveedor_suscripcion is not distinct from p_proveedor_suscripcion;
  end if;
end $$;

-- ───────────── Permisos ─────────────
revoke all on table public.suscripciones, public.pagos, public.eventos_pago, public.secretos from anon, authenticated;
revoke all on table public.planes from anon, authenticated;
grant select on table public.planes to anon, authenticated;

revoke execute on function public.crear_suscripcion_de_prueba() from public, anon, authenticated;
revoke execute on function public.cuenta_de(uuid) from public, anon, authenticated;
revoke execute on function public.exigir_cuenta_activa() from public, anon, authenticated;
revoke execute on function public.controlar_cupo_unidades() from public, anon, authenticated;
revoke execute on function public.pagos_autorizar(text) from public, anon, authenticated;
revoke execute on function public.estado_cuenta(uuid) from public, anon;
grant execute on function public.estado_cuenta(uuid) to authenticated;
revoke execute on function public.mi_suscripcion(uuid) from public, anon;
grant execute on function public.mi_suscripcion(uuid) to authenticated;
revoke execute on function public.pagos_recibir_evento(text, text, text, text, text) from public;
revoke execute on function public.pagos_cerrar_evento(text, text, text, text) from public;
revoke execute on function public.pagos_actualizar_suscripcion(text, uuid, text, text, public.estado_suscripcion, numeric, text, text, timestamptz, boolean, text) from public;
revoke execute on function public.pagos_registrar_cobro(text, uuid, text, text, text, text, numeric, timestamptz, timestamptz, text) from public;
grant execute on function public.pagos_recibir_evento(text, text, text, text, text) to anon, authenticated;
grant execute on function public.pagos_cerrar_evento(text, text, text, text) to anon, authenticated;
grant execute on function public.pagos_actualizar_suscripcion(text, uuid, text, text, public.estado_suscripcion, numeric, text, text, timestamptz, boolean, text) to anon, authenticated;
grant execute on function public.pagos_registrar_cobro(text, uuid, text, text, text, text, numeric, timestamptz, timestamptz, text) to anon, authenticated;
