-- Fase 2 de seguridad: límite de intentos de acceso, registro de actividad (auditoría) y al menos un
-- administrador por empresa. Se ejecuta una sola vez, después de la 0003.

-- ───────────── Límite de intentos de ingreso y registro ─────────────
-- Contadores por ventana de tiempo. La clave la arma el servidor de la app: un hash de la acción y del mail
-- o la IP, firmado con un secreto propio, así quien llame a la función directo no puede apuntar a otra persona.
create table public.limites_acceso (
  clave text primary key check (length(clave) between 16 and 128),
  accion text not null,
  intentos int not null default 1,
  desde timestamptz not null default now()
);
create index on public.limites_acceso (desde);
-- Sin políticas: nadie la lee ni la escribe directo, sólo a través de consumir_intento.
alter table public.limites_acceso enable row level security;

-- Suma un intento y dice si todavía está dentro del tope. Cada acción tiene su tope y su ventana fijos acá:
-- quien llama no puede achicar la ventana para reiniciar un contador.
create function public.consumir_intento(p_accion text, p_clave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_maximo int;
  v_ventana interval;
  v_intentos int;
begin
  select l.maximo, l.ventana into v_maximo, v_ventana
  from (values
    ('ingresar_mail', 10, interval '15 minutes'),
    ('ingresar_ip', 50, interval '15 minutes'),
    ('registro_ip', 10, interval '1 hour')
  ) as l (accion, maximo, ventana)
  where l.accion = p_accion;
  if v_maximo is null then raise exception 'Acción desconocida'; end if;
  -- De vez en cuando se borran los contadores de más de un día.
  if random() < 0.05 then delete from limites_acceso where desde < now() - interval '1 day'; end if;
  insert into limites_acceso as c (clave, accion) values (p_clave, p_accion)
  on conflict (clave) do update set
    intentos = case when c.desde < now() - v_ventana then 1 else c.intentos + 1 end,
    desde = case when c.desde < now() - v_ventana then now() else c.desde end
  returning c.intentos into v_intentos;
  return v_intentos <= v_maximo;
end $$;

-- ───────────── Auditoría ─────────────
-- Quién hizo qué, con qué rol, sobre qué, cuándo y desde dónde. La llenan triggers y funciones de la base:
-- nadie la escribe, edita ni borra a mano. Sólo el administrador de cada empresa lee la suya.
create table public.auditoria (
  id bigint generated always as identity primary key,
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  user_id uuid,
  quien text,
  rol text,
  accion text not null,
  categoria text not null,
  recurso text not null,
  recurso_id text,
  detalle jsonb not null default '{}'::jsonb,
  ip text,
  agente text,
  creado_en timestamptz not null default now()
);
create index on public.auditoria (organizacion_id, id desc);
create index on public.auditoria (organizacion_id, categoria, id desc);
alter table public.auditoria enable row level security;
create policy auditoria_leer on public.auditoria for select to authenticated
  using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

-- Anota un evento con la sesión actual. La IP y el navegador de la persona los manda la app en cabeceras
-- propias (los pedidos a la base salen del servidor, no del celular).
create function public.registrar_evento(p_org uuid, p_accion text, p_recurso text, p_recurso_id text, p_detalle jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  cab jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_quien text;
  v_rol text;
begin
  if p_org is null or not exists (select 1 from organizaciones where id = p_org) then return; end if;
  select coalesce(m.nombre, u.email), m.rol::text into v_quien, v_rol
  from auth.users u left join miembros m on m.user_id = u.id and m.organizacion_id = p_org
  where u.id = auth.uid();
  insert into auditoria (organizacion_id, user_id, quien, rol, accion, categoria, recurso, recurso_id, detalle, ip, agente)
  values (
    p_org, auth.uid(), v_quien, v_rol, p_accion,
    case split_part(p_accion, '.', 1)
      when 'miembro' then 'equipo' when 'invitacion' then 'equipo'
      when 'unidad' then 'flota' when 'chofer' then 'flota'
      when 'gasto' then 'gastos'
      when 'documento' then 'documentos' when 'tipo_documento' then 'documentos'
      when 'orden' then 'taller' when 'falla' then 'taller'
      else 'seguridad'
    end,
    p_recurso, p_recurso_id, coalesce(p_detalle, '{}'::jsonb),
    left(cab ->> 'x-flotapp-ip', 64), left(cab ->> 'x-flotapp-agente', 300)
  );
end $$;

-- Equipo: altas, cambios de rol y bajas.
create function public.auditar_miembros() returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  if tg_op = 'DELETE' then
    select coalesce(old.nombre, u.email) into v_nombre from auth.users u where u.id = old.user_id;
    perform registrar_evento(old.organizacion_id, 'miembro.baja', 'miembros', old.user_id::text,
      jsonb_build_object('nombre', coalesce(v_nombre, old.nombre), 'rol', old.rol));
    return old;
  end if;
  select coalesce(new.nombre, u.email) into v_nombre from auth.users u where u.id = new.user_id;
  if tg_op = 'INSERT' then
    perform registrar_evento(new.organizacion_id, 'miembro.alta', 'miembros', new.user_id::text, jsonb_build_object('nombre', v_nombre, 'rol', new.rol));
  elsif new.rol is distinct from old.rol then
    perform registrar_evento(new.organizacion_id, 'miembro.rol', 'miembros', new.user_id::text, jsonb_build_object('nombre', v_nombre, 'de', old.rol, 'a', new.rol));
  end if;
  return new;
end $$;
create trigger miembros_auditar after insert or update of rol or delete on public.miembros
  for each row execute function public.auditar_miembros();

-- Invitaciones creadas y canceladas (el token nunca se guarda en la auditoría).
create function public.auditar_invitaciones() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_evento(new.organizacion_id, 'invitacion.creada', 'invitaciones', new.id::text, jsonb_build_object('nombre', new.nombre, 'rol', new.rol));
  elsif new.revocada and not old.revocada then
    perform registrar_evento(new.organizacion_id, 'invitacion.cancelada', 'invitaciones', new.id::text, jsonb_build_object('nombre', new.nombre, 'rol', new.rol));
  end if;
  return new;
end $$;
create trigger invitaciones_auditar after insert or update of revocada on public.invitaciones
  for each row execute function public.auditar_invitaciones();

-- Flota: unidades eliminadas, dadas de baja o reactivadas, y choferes eliminados.
create function public.auditar_unidades() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform registrar_evento(old.organizacion_id, 'unidad.borrada', 'unidades', old.id::text,
      jsonb_build_object('dominio', old.dominio, 'marca', old.marca, 'modelo', old.modelo));
    return old;
  end if;
  if new.estado = 'baja' and old.estado <> 'baja' then
    perform registrar_evento(new.organizacion_id, 'unidad.baja', 'unidades', new.id::text, jsonb_build_object('dominio', new.dominio));
  elsif old.estado = 'baja' and new.estado <> 'baja' then
    perform registrar_evento(new.organizacion_id, 'unidad.reactivada', 'unidades', new.id::text, jsonb_build_object('dominio', new.dominio));
  end if;
  return new;
end $$;
create trigger unidades_auditar after update of estado or delete on public.unidades
  for each row execute function public.auditar_unidades();

create function public.auditar_choferes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform registrar_evento(old.organizacion_id, 'chofer.borrado', 'choferes', old.id::text, jsonb_build_object('nombre', old.nombre));
  return old;
end $$;
create trigger choferes_auditar after delete on public.choferes for each row execute function public.auditar_choferes();

-- Gastos borrados: plata que deja de figurar.
create function public.auditar_gastos() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform registrar_evento(old.organizacion_id, 'gasto.borrado', 'gastos', old.id::text, jsonb_build_object(
    'categoria', old.categoria, 'monto', old.monto, 'fecha', old.fecha,
    'dominio', (select dominio from unidades where id = old.unidad_id)));
  return old;
end $$;
create trigger gastos_auditar after delete on public.gastos for each row execute function public.auditar_gastos();

-- Documentos: renovados (cambia el vencimiento) y eliminados; tipos de documento eliminados.
create function public.auditar_documentos() returns trigger language plpgsql security definer set search_path = public as $$
declare
  d documentos := coalesce(new, old);
  v_tipo text;
  v_titular text;
begin
  select nombre into v_tipo from tipos_documento where id = d.tipo_documento_id;
  v_titular := coalesce((select dominio from unidades where id = d.unidad_id), (select nombre from choferes where id = d.chofer_id));
  if tg_op = 'DELETE' then
    perform registrar_evento(old.organizacion_id, 'documento.borrado', 'documentos', old.id::text,
      jsonb_build_object('tipo', v_tipo, 'titular', v_titular, 'vence', old.vence));
    return old;
  end if;
  if new.vence is distinct from old.vence then
    perform registrar_evento(new.organizacion_id, 'documento.renovado', 'documentos', new.id::text,
      jsonb_build_object('tipo', v_tipo, 'titular', v_titular, 'de', old.vence, 'a', new.vence));
  end if;
  return new;
end $$;
create trigger documentos_auditar after update of vence or delete on public.documentos
  for each row execute function public.auditar_documentos();

create function public.auditar_tipos_documento() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform registrar_evento(old.organizacion_id, 'tipo_documento.borrado', 'tipos_documento', old.id::text, jsonb_build_object('nombre', old.nombre));
  return old;
end $$;
create trigger tipos_documento_auditar after delete on public.tipos_documento
  for each row execute function public.auditar_tipos_documento();

-- Taller: órdenes cerradas (con su costo) y fallas descartadas.
create function public.auditar_ordenes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'cerrada' and (tg_op = 'INSERT' or old.estado <> 'cerrada') then
    perform registrar_evento(new.organizacion_id, 'orden.cerrada', 'ordenes', new.id::text, jsonb_build_object(
      'numero', new.numero, 'descripcion', new.descripcion,
      'dominio', (select dominio from unidades where id = new.unidad_id),
      'costo', coalesce(new.repuestos, 0) + coalesce(new.mano_obra, 0)));
  end if;
  return new;
end $$;
create trigger ordenes_auditar after insert or update of estado on public.ordenes
  for each row execute function public.auditar_ordenes();

create function public.auditar_fallas() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'descartada' and old.estado <> 'descartada' then
    perform registrar_evento(new.organizacion_id, 'falla.descartada', 'fallas', new.id::text, jsonb_build_object(
      'sistema', new.sistema, 'descripcion', new.descripcion, 'gravedad', new.gravedad,
      'dominio', (select dominio from unidades where id = new.unidad_id)));
  end if;
  return new;
end $$;
create trigger fallas_auditar after update of estado on public.fallas for each row execute function public.auditar_fallas();

-- Intentos de entrar donde el rol no deja. Sólo anota en empresas donde la persona es miembro, y no repite
-- el mismo aviso dentro del mismo minuto.
create function public.auditar_denegado(p_org uuid, p_que text)
returns void language plpgsql security definer set search_path = public as $$
declare v_que text := left(coalesce(p_que, ''), 120);
begin
  if v_que = '' or not public.es_miembro(p_org) then return; end if;
  if exists (
    select 1 from auditoria
    where organizacion_id = p_org and user_id = auth.uid() and accion = 'permiso.denegado'
      and detalle ->> 'que' = v_que and creado_en > now() - interval '1 minute'
  ) then return; end if;
  perform registrar_evento(p_org, 'permiso.denegado', 'app', null, jsonb_build_object('que', v_que));
end $$;

-- Último ingreso de cada integrante, para la pantalla Equipo (sólo administradores).
create function public.ultimos_ingresos(p_org uuid)
returns table (user_id uuid, ultimo_ingreso timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.last_sign_in_at
  from miembros m join auth.users u on u.id = m.user_id
  where m.organizacion_id = p_org and public.es_miembro(p_org, array['admin']::rol_miembro[]);
$$;

-- ───────────── Al menos un administrador por empresa ─────────────
create function public.mantener_un_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.rol <> 'admin' or (tg_op = 'UPDATE' and new.rol = 'admin') then return coalesce(new, old); end if;
  -- Se está borrando la empresa entera o la cuenta de la persona: no hay a quién dejar a cargo.
  if not exists (select 1 from organizaciones where id = old.organizacion_id)
     or not exists (select 1 from auth.users where id = old.user_id) then
    return coalesce(new, old);
  end if;
  -- Bloquea a los administradores mientras se decide: dos bajas al mismo tiempo no dejan la empresa sin ninguno.
  perform 1 from miembros where organizacion_id = old.organizacion_id and rol = 'admin' for update;
  if not exists (select 1 from miembros where organizacion_id = old.organizacion_id and rol = 'admin' and user_id <> old.user_id) then
    raise exception 'La empresa tiene que tener al menos un administrador. Antes nombrá a otra persona como administradora.';
  end if;
  return coalesce(new, old);
end $$;
create trigger miembros_un_admin before update of rol or delete on public.miembros
  for each row execute function public.mantener_un_admin();

-- ───────────── Permisos ─────────────
-- Supabase da todos los permisos sobre cada tabla nueva: se dejan sólo los necesarios.
revoke all on table public.limites_acceso from anon, authenticated;
revoke all on table public.auditoria from anon, authenticated;
grant select on table public.auditoria to authenticated;

revoke execute on function public.consumir_intento(text, text) from public;
grant execute on function public.consumir_intento(text, text) to anon, authenticated;
revoke execute on function public.registrar_evento(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.auditar_miembros() from public, anon, authenticated;
revoke execute on function public.auditar_invitaciones() from public, anon, authenticated;
revoke execute on function public.auditar_unidades() from public, anon, authenticated;
revoke execute on function public.auditar_choferes() from public, anon, authenticated;
revoke execute on function public.auditar_gastos() from public, anon, authenticated;
revoke execute on function public.auditar_documentos() from public, anon, authenticated;
revoke execute on function public.auditar_tipos_documento() from public, anon, authenticated;
revoke execute on function public.auditar_ordenes() from public, anon, authenticated;
revoke execute on function public.auditar_fallas() from public, anon, authenticated;
revoke execute on function public.mantener_un_admin() from public, anon, authenticated;
revoke execute on function public.auditar_denegado(uuid, text) from public, anon;
grant execute on function public.auditar_denegado(uuid, text) to authenticated;
revoke execute on function public.ultimos_ingresos(uuid) from public, anon;
grant execute on function public.ultimos_ingresos(uuid) to authenticated;
