-- Flotapp · 0002: apps de chofer y taller, viajes con QR, fallas con fotos, gastos, invitaciones y tablero
--
-- Ejecutar una sola vez, después de 0001. Todo el script corre en una transacción: si algo falla, no queda a medias.

-- ───────────── Rol de mecánico ─────────────
-- El valor nuevo no se puede usar como literal hasta que termine la transacción: por eso los
-- controles de rol de este script comparan texto (rol::text) en lugar de literales del tipo.
alter type public.rol_miembro add value if not exists 'mecanico';

create function public.tiene_rol(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros m
    where m.organizacion_id = org and m.user_id = auth.uid() and m.rol::text = any (roles)
  );
$$;

-- Taller interno: puede registrar trabajos, resolver fallas y operar neumáticos.
create function public.es_mecanico(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_rol(org, array['admin', 'jefe_taller', 'mecanico']);
$$;

-- Gerencia: ve todos los viajes, gastos y el tablero.
create function public.es_gerencia(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_rol(org, array['admin', 'jefe_taller', 'lectura']);
$$;

-- Quien carga datos en el día a día (kilometraje, fallas, fotos).
create or replace function public.es_operativo(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_rol(org, array['admin', 'jefe_taller', 'chofer', 'mecanico']);
$$;

-- El chofer (registro de la flota) vinculado a la cuenta del usuario.
create function public.mi_chofer_id(org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select chofer_id from miembros where organizacion_id = org and user_id = auth.uid();
$$;

-- ───────────── QR único por unidad ─────────────
-- 8 caracteres sin letras ni números que se confundan (sin 0/O ni 1/I): sirve para el QR y para tipearlo.
create function public.nuevo_token_qr()
returns text language plpgsql volatile as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  t text := '';
  i int;
begin
  -- Bytes del uuid con los 5 bits bajos al azar (se evitan los fijos de versión).
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
    t := t || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return t;
end $$;

alter table public.unidades add column qr_token text;
update public.unidades set qr_token = public.nuevo_token_qr() where qr_token is null;
alter table public.unidades alter column qr_token set default public.nuevo_token_qr();
alter table public.unidades alter column qr_token set not null;
alter table public.unidades add constraint unidades_qr_token_key unique (qr_token);

-- ───────────── Catálogo del chequeo previo al viaje ─────────────
create table public.items_chequeo (
  clave text primary key,
  nombre text not null,
  ayuda text,
  critico boolean not null default false,
  orden int not null,
  solo_tipos public.tipo_unidad[]
);
insert into public.items_chequeo (clave, nombre, ayuda, critico, orden, solo_tipos) values
  ('neumaticos', 'Neumáticos y presión', 'Cortes, desgaste, presión visible', true, 1, null),
  ('frenos', 'Frenos y aire', 'Presión de aire, pérdidas, freno de mano', true, 2, null),
  ('luces', 'Luces y balizas', 'Delanteras, traseras, giros y frenado', true, 3, null),
  ('direccion', 'Dirección y suspensión', 'Juego en el volante, elásticos, amortiguadores', true, 4, null),
  ('enganche', 'Quinta rueda y enganche', 'Traba, perno rey, mangueras y conexiones', true, 5, '{tractor}'),
  ('niveles', 'Aceite y refrigerante', 'Niveles en rango', false, 6, null),
  ('perdidas', 'Pérdidas', 'Aceite, gasoil o agua debajo de la unidad', false, 7, null),
  ('visibilidad', 'Espejos y parabrisas', 'Espejos, limpiaparabrisas y vidrios', false, 8, null),
  ('seguridad', 'Matafuego y balizas', 'Matafuego cargado, balizas triangulares, botiquín', false, 9, null),
  ('tacografo', 'Tacógrafo', 'Funciona y registra', false, 10, '{tractor,chasis}'),
  ('documentacion', 'Documentación a bordo', 'Cédula, seguro, RTO y licencia', false, 11, null);

-- ───────────── Viajes, chequeos y fallas ─────────────
create type public.estado_viaje as enum ('en_curso', 'terminado', 'cancelado');
create type public.gravedad_falla as enum ('leve', 'moderada', 'critica');
create type public.estado_falla as enum ('abierta', 'en_reparacion', 'resuelta', 'descartada');

create table public.chequeos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  chofer_id uuid,
  user_id uuid not null default auth.uid(),
  fecha timestamptz not null default now(),
  km int check (km >= 0),
  combustible smallint check (combustible between 0 and 100),
  items jsonb not null,
  aprobado boolean not null,
  unique (id, organizacion_id),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade,
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id)
);
create index on public.chequeos (organizacion_id, fecha);

create table public.viajes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  chofer_id uuid,
  user_id uuid not null default auth.uid(),
  estado public.estado_viaje not null default 'en_curso',
  inicio timestamptz not null default now(),
  fin timestamptz,
  km_inicio int not null check (km_inicio >= 0),
  km_fin int,
  combustible_inicio smallint check (combustible_inicio between 0 and 100),
  combustible_fin smallint check (combustible_fin between 0 and 100),
  destino text,
  observaciones text,
  chequeo_id uuid,
  unique (id, organizacion_id),
  check (km_fin is null or km_fin >= km_inicio),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id),
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id),
  foreign key (chequeo_id, organizacion_id) references public.chequeos (id, organizacion_id) on delete set null (chequeo_id)
);
-- Una unidad y una persona no pueden estar en dos viajes a la vez.
create unique index viajes_unidad_en_curso on public.viajes (unidad_id) where estado = 'en_curso';
create unique index viajes_usuario_en_curso on public.viajes (user_id) where estado = 'en_curso';
create index on public.viajes (organizacion_id, inicio);

alter table public.ordenes add column fotos text[] not null default '{}';
alter table public.ordenes add column cerrada_por uuid;

create table public.fallas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  sistema text not null,
  descripcion text,
  gravedad public.gravedad_falla not null default 'moderada',
  estado public.estado_falla not null default 'abierta',
  fotos text[] not null default '{}',
  origen text not null default 'viaje' check (origen in ('chequeo', 'viaje', 'taller', 'administracion')),
  chequeo_id uuid,
  viaje_id uuid,
  chofer_id uuid,
  orden_id uuid,
  reportada_por uuid default auth.uid(),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz,
  unique (id, organizacion_id),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade,
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id),
  foreign key (orden_id, organizacion_id) references public.ordenes (id, organizacion_id) on delete set null (orden_id),
  foreign key (viaje_id, organizacion_id) references public.viajes (id, organizacion_id) on delete set null (viaje_id),
  foreign key (chequeo_id, organizacion_id) references public.chequeos (id, organizacion_id) on delete set null (chequeo_id)
);
create index on public.fallas (organizacion_id, estado);
create index on public.fallas (unidad_id);

-- ───────────── Gastos ─────────────
-- El mantenimiento sale de las órdenes (repuestos + mano de obra); acá va todo lo demás.
create type public.categoria_gasto as enum ('combustible', 'peaje', 'viatico', 'neumaticos', 'seguro', 'patente', 'multa', 'lavado', 'otro');

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  categoria public.categoria_gasto not null,
  monto numeric(14, 2) not null check (monto > 0),
  fecha date not null default current_date,
  unidad_id uuid,
  chofer_id uuid,
  viaje_id uuid,
  litros numeric(8, 2) check (litros > 0),
  km int check (km >= 0),
  descripcion text,
  foto text,
  cargado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete set null (unidad_id),
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id),
  foreign key (viaje_id, organizacion_id) references public.viajes (id, organizacion_id) on delete set null (viaje_id)
);
create index on public.gastos (organizacion_id, fecha);

-- ───────────── Vencimientos: foto del documento ─────────────
alter table public.documentos add column foto text;

-- ───────────── Invitaciones ─────────────
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  rol public.rol_miembro not null,
  chofer_id uuid,
  nombre text,
  creada_por uuid default auth.uid(),
  creada_en timestamptz not null default now(),
  vence timestamptz not null default now() + interval '7 days',
  usada_por uuid,
  usada_en timestamptz,
  revocada boolean not null default false,
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id)
);

-- El control diario del prototipo queda reemplazado por el chequeo previo al viaje.
drop table public.controles_diarios;

-- ───────────── Seguridad por fila ─────────────
alter table public.items_chequeo enable row level security;
create policy items_chequeo_leer on public.items_chequeo for select to authenticated using (true);

alter table public.chequeos enable row level security;
create policy chequeos_leer on public.chequeos for select to authenticated
  using (public.es_gerencia(organizacion_id) or public.es_mecanico(organizacion_id) or user_id = auth.uid());

alter table public.viajes enable row level security;
create policy viajes_leer on public.viajes for select to authenticated
  using (public.es_gerencia(organizacion_id) or public.es_mecanico(organizacion_id) or user_id = auth.uid());
create policy viajes_editar on public.viajes for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));

alter table public.fallas enable row level security;
create policy fallas_leer on public.fallas for select to authenticated using (public.es_miembro(organizacion_id));
create policy fallas_crear on public.fallas for insert to authenticated with check (public.es_operativo(organizacion_id));
create policy fallas_editar on public.fallas for update to authenticated
  using (public.es_mecanico(organizacion_id)) with check (public.es_mecanico(organizacion_id));

alter table public.gastos enable row level security;
create policy gastos_leer on public.gastos for select to authenticated
  using (public.es_gerencia(organizacion_id) or cargado_por = auth.uid());
-- El chofer sólo carga gastos a su nombre; la gerencia carga cualquiera.
create policy gastos_crear on public.gastos for insert to authenticated
  with check (public.es_gestor(organizacion_id)
    or (public.tiene_rol(organizacion_id, array['chofer']) and chofer_id is not distinct from public.mi_chofer_id(organizacion_id)));
create policy gastos_editar on public.gastos for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));
create policy gastos_borrar on public.gastos for delete to authenticated using (public.es_gestor(organizacion_id));

alter table public.invitaciones enable row level security;
create policy invitaciones_admin on public.invitaciones for all to authenticated
  using (public.tiene_rol(organizacion_id, array['admin'])) with check (public.tiene_rol(organizacion_id, array['admin']));

-- El taller interno registra órdenes y opera neumáticos.
alter policy ordenes_crear on public.ordenes with check (public.es_mecanico(organizacion_id));
alter policy ordenes_editar on public.ordenes using (public.es_mecanico(organizacion_id)) with check (public.es_mecanico(organizacion_id));
alter policy neumaticos_crear on public.neumaticos with check (public.es_mecanico(organizacion_id));
alter policy neumaticos_editar on public.neumaticos using (public.es_mecanico(organizacion_id)) with check (public.es_mecanico(organizacion_id));
alter policy eventos_crear on public.neumatico_eventos with check (public.es_mecanico(organizacion_id));

-- ───────────── Fotos (Supabase Storage) ─────────────
-- Ruta: <organizacion>/<categoria>/<archivo>. La primera carpeta decide quién la ve.
create function public.org_de_ruta(ruta text)
returns uuid language sql immutable as $$
  select case when split_part(ruta, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(ruta, '/', 1)::uuid end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_operativo(public.org_de_ruta(name)));
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (public.es_miembro(public.org_de_ruta(name)) or public.es_proveedor_de(public.org_de_ruta(name))));
create policy fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_gestor(public.org_de_ruta(name)));

-- ───────────── Operaciones del chofer ─────────────
-- Ficha de la unidad que abre el QR. Corre con los permisos del usuario: si no es de su flota, no ve nada.
create function public.ficha_qr(p_token text)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'unidad', jsonb_build_object('id', u.id, 'organizacion_id', u.organizacion_id, 'dominio', u.dominio, 'tipo', u.tipo,
      'marca', u.marca, 'modelo', u.modelo, 'km', u.km, 'estado', u.estado),
    'empresa', (select nombre from organizaciones o where o.id = u.organizacion_id),
    'mi_rol', (select rol from miembros m where m.organizacion_id = u.organizacion_id and m.user_id = auth.uid()),
    'viaje_en_curso', (select jsonb_build_object('id', v.id, 'mio', v.user_id = auth.uid(), 'inicio', v.inicio,
        'chofer', (select nombre from choferes c where c.id = v.chofer_id))
      from viajes v where v.unidad_id = u.id and v.estado = 'en_curso'),
    'fallas_abiertas', (select count(*) from fallas f where f.unidad_id = u.id and f.estado in ('abierta', 'en_reparacion')),
    'items', (select jsonb_agg(jsonb_build_object('clave', i.clave, 'nombre', i.nombre, 'ayuda', i.ayuda, 'critico', i.critico) order by i.orden)
      from items_chequeo i where i.solo_tipos is null or u.tipo = any (i.solo_tipos))
  )
  from unidades u where u.qr_token = upper(trim(p_token));
$$;

-- Inicia un viaje: exige el chequeo completo. Una falla crítica no deja salir y manda la unidad al taller.
create function public.iniciar_viaje(p_token text, p_km int, p_combustible smallint, p_items jsonb, p_destino text default null)
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
  respuesta jsonb;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into u from unidades where qr_token = upper(trim(p_token));
  if u.id is null then raise exception 'No encontramos la unidad'; end if;
  select m.rol::text, m.chofer_id into rol_txt, mi_chofer from miembros m where m.organizacion_id = u.organizacion_id and m.user_id = auth.uid();
  if rol_txt is null or rol_txt not in ('chofer', 'admin', 'jefe_taller') then raise exception 'No encontramos la unidad'; end if;
  if u.estado = 'baja' then raise exception 'La unidad está dada de baja'; end if;
  if u.estado = 'taller' then raise exception 'La unidad está en el taller. Consultá con el encargado antes de salir'; end if;
  if exists (select 1 from viajes where unidad_id = u.id and estado = 'en_curso') then raise exception 'La unidad ya está en viaje'; end if;
  if exists (select 1 from viajes where user_id = auth.uid() and estado = 'en_curso') then raise exception 'Ya tenés un viaje en curso. Terminalo antes de empezar otro'; end if;
  if p_km is null or p_km < 0 then raise exception 'Cargá el kilometraje del tablero'; end if;
  if u.km is not null and p_km < u.km then raise exception 'El kilometraje no puede ser menor al último registrado (% km)', u.km; end if;
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

create function public.terminar_viaje(p_viaje uuid, p_km int, p_combustible smallint, p_observaciones text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v viajes;
begin
  select * into v from viajes where id = p_viaje for update;
  if v.id is null or not (v.user_id = auth.uid() or public.es_gestor(v.organizacion_id)) then raise exception 'No encontramos el viaje'; end if;
  if v.estado <> 'en_curso' then raise exception 'El viaje ya terminó'; end if;
  if p_km is null or p_km < v.km_inicio then raise exception 'El kilometraje final no puede ser menor al de salida (% km)', v.km_inicio; end if;
  update viajes set estado = 'terminado', fin = now(), km_fin = p_km, combustible_fin = p_combustible,
    observaciones = nullif(trim(p_observaciones), '') where id = v.id;
  insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (v.organizacion_id, v.unidad_id, p_km, 'viaje', auth.uid());
end $$;

-- ───────────── Operaciones del taller ─────────────
-- La unidad vuelve a estar en servicio cuando no le quedan fallas críticas ni órdenes que la dejen parada.
create function public.liberar_unidad_si_corresponde(p_unidad uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update unidades u set estado = 'operativa'
  where u.id = p_unidad and u.estado = 'taller'
    and not exists (select 1 from fallas f where f.unidad_id = u.id and f.gravedad = 'critica' and f.estado in ('abierta', 'en_reparacion'))
    and not exists (select 1 from ordenes o where o.unidad_id = u.id and o.estado <> 'cerrada' and o.deja_fuera_servicio);
end $$;

-- Un trabajo terminado en un solo paso: crea la orden cerrada y resuelve las fallas que atendió.
create function public.registrar_trabajo(p_unidad uuid, p_tipo public.tipo_orden, p_descripcion text, p_trabajo text,
  p_fotos text[] default '{}', p_repuestos numeric default 0, p_mano_obra numeric default 0, p_km int default null,
  p_fallas uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare u unidades; orden uuid;
begin
  select * into u from unidades where id = p_unidad;
  if u.id is null or not public.es_mecanico(u.organizacion_id) then raise exception 'No encontramos la unidad'; end if;
  if coalesce(trim(p_descripcion), '') = '' then raise exception 'Contá qué trabajo se hizo'; end if;
  insert into ordenes (organizacion_id, unidad_id, tipo, descripcion, nota, fotos, repuestos, mano_obra, km, estado,
    fecha_ingreso, fecha_egreso, cerrada_por)
  values (u.organizacion_id, u.id, p_tipo, trim(p_descripcion), nullif(trim(p_trabajo), ''), coalesce(p_fotos, '{}'),
    coalesce(p_repuestos, 0), coalesce(p_mano_obra, 0), p_km, 'cerrada', current_date, current_date, auth.uid())
  returning id into orden;
  update fallas set estado = 'resuelta', resuelta_en = now(), orden_id = orden
  where id = any (coalesce(p_fallas, '{}')) and unidad_id = u.id and estado in ('abierta', 'en_reparacion');
  if p_km is not null then
    insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (u.organizacion_id, u.id, p_km, 'taller', auth.uid());
  end if;
  perform public.liberar_unidad_si_corresponde(u.id);
  return orden;
end $$;

-- Una reparación que lleva tiempo: queda abierta y, si hace falta, la unidad queda parada.
create function public.abrir_orden(p_unidad uuid, p_descripcion text, p_tipo public.tipo_orden default 'correctivo',
  p_fallas uuid[] default '{}', p_deja_fuera_servicio boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare u unidades; orden uuid;
begin
  select * into u from unidades where id = p_unidad;
  if u.id is null or not public.es_mecanico(u.organizacion_id) then raise exception 'No encontramos la unidad'; end if;
  if coalesce(trim(p_descripcion), '') = '' then raise exception 'Contá qué hay que hacer'; end if;
  insert into ordenes (organizacion_id, unidad_id, tipo, descripcion, estado, deja_fuera_servicio, km)
  values (u.organizacion_id, u.id, p_tipo, trim(p_descripcion), 'abierta', p_deja_fuera_servicio, u.km)
  returning id into orden;
  update fallas set estado = 'en_reparacion', orden_id = orden
  where id = any (coalesce(p_fallas, '{}')) and unidad_id = u.id and estado = 'abierta';
  if p_deja_fuera_servicio then update unidades set estado = 'taller' where id = u.id and estado = 'operativa'; end if;
  return orden;
end $$;

create function public.cerrar_orden(p_orden uuid, p_trabajo text, p_fotos text[] default '{}', p_repuestos numeric default 0,
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
  update fallas set estado = 'resuelta', resuelta_en = now() where orden_id = o.id and estado in ('abierta', 'en_reparacion');
  if p_km is not null then
    insert into lecturas_km (organizacion_id, unidad_id, km, origen, user_id) values (o.organizacion_id, o.unidad_id, p_km, 'taller', auth.uid());
  end if;
  perform public.liberar_unidad_si_corresponde(o.unidad_id);
end $$;

-- ───────────── Invitaciones ─────────────
-- Lo mínimo para mostrar la invitación a quien todavía no es miembro.
create function public.ver_invitacion(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'empresa', o.nombre, 'tipo', o.tipo, 'rol', i.rol, 'nombre', i.nombre,
    'estado', case when i.revocada then 'revocada' when i.usada_en is not null then 'usada' when i.vence < now() then 'vencida' else 'vigente' end)
  from invitaciones i join organizaciones o on o.id = i.organizacion_id
  where i.token = p_token;
$$;

create function public.aceptar_invitacion(p_token text)
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
  insert into miembros (organizacion_id, user_id, rol, chofer_id) values (i.organizacion_id, auth.uid(), i.rol, i.chofer_id)
  on conflict (organizacion_id, user_id) do update set chofer_id = coalesce(miembros.chofer_id, excluded.chofer_id);
  update invitaciones set usada_por = auth.uid(), usada_en = now() where id = i.id;
  return jsonb_build_object('organizacion_id', i.organizacion_id,
    'rol', (select rol from miembros where organizacion_id = i.organizacion_id and user_id = auth.uid()));
end $$;

-- ───────────── Tablero de la gerencia ─────────────
-- Costos operativos del período por categoría, mes, unidad y chofer, más el estado actual de la flota.
create function public.tablero(p_org uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable set search_path = public as $$
declare r jsonb;
begin
  if not public.es_gerencia(p_org) then raise exception 'Sin acceso al tablero'; end if;
  with
  costos as (
    select g.categoria::text categoria, g.monto, g.fecha, g.unidad_id, g.chofer_id, g.litros
    from gastos g where g.organizacion_id = p_org and g.fecha between p_desde and p_hasta
    union all
    select 'mantenimiento', o.repuestos + o.mano_obra, o.fecha_egreso, o.unidad_id, null::uuid, null::numeric
    from ordenes o where o.organizacion_id = p_org and o.estado = 'cerrada' and o.fecha_egreso between p_desde and p_hasta
      and o.repuestos + o.mano_obra > 0
  ),
  km_unidad as (
    select l.unidad_id,
      greatest(0, max(l.km) filter (where l.fecha <= p_hasta)
        - coalesce(max(l.km) filter (where l.fecha < p_desde), min(l.km) filter (where l.fecha between p_desde and p_hasta))) km
    from lecturas_km l where l.organizacion_id = p_org group by l.unidad_id
  ),
  viajes_p as (
    select v.* from viajes v where v.organizacion_id = p_org and v.estado = 'terminado' and v.fin::date between p_desde and p_hasta
  ),
  por_unidad as (
    select u.id, u.dominio, u.marca, u.modelo, u.tipo, u.estado,
      coalesce(k.km, 0) km,
      coalesce((select sum(c.monto) from costos c where c.unidad_id = u.id), 0) costo,
      coalesce((select sum(c.litros) from costos c where c.unidad_id = u.id and c.categoria = 'combustible'), 0) litros,
      coalesce((select sum(c.monto) from costos c where c.unidad_id = u.id and c.categoria = 'mantenimiento'), 0) mantenimiento,
      (select count(*) from viajes_p v where v.unidad_id = u.id) viajes,
      (select count(*) from fallas f where f.unidad_id = u.id and f.creada_en::date between p_desde and p_hasta) fallas
    from unidades u left join km_unidad k on k.unidad_id = u.id
    where u.organizacion_id = p_org and u.estado <> 'baja'
  ),
  por_chofer as (
    select ch.id, ch.nombre,
      (select count(*) from viajes_p v where v.chofer_id = ch.id) viajes,
      coalesce((select sum(v.km_fin - v.km_inicio) from viajes_p v where v.chofer_id = ch.id), 0) km,
      coalesce((select sum(c.monto) from costos c where c.chofer_id = ch.id), 0) gastos,
      coalesce((select sum(c.litros) from costos c where c.chofer_id = ch.id and c.categoria = 'combustible'), 0) litros,
      (select count(*) from fallas f where f.chofer_id = ch.id and f.creada_en::date between p_desde and p_hasta) fallas,
      (select count(*) from chequeos q where q.chofer_id = ch.id and q.fecha::date between p_desde and p_hasta) chequeos
    from choferes ch where ch.organizacion_id = p_org
  ),
  meses as (
    select to_char(date_trunc('month', m), 'YYYY-MM') mes
    from generate_series(date_trunc('month', p_hasta::timestamp) - interval '11 months', date_trunc('month', p_hasta::timestamp), interval '1 month') m
  ),
  costos_12 as (
    select g.categoria::text categoria, g.monto, g.fecha from gastos g
    where g.organizacion_id = p_org and g.fecha >= (date_trunc('month', p_hasta::timestamp) - interval '11 months')::date and g.fecha <= p_hasta
    union all
    select 'mantenimiento', o.repuestos + o.mano_obra, o.fecha_egreso from ordenes o
    where o.organizacion_id = p_org and o.estado = 'cerrada' and o.repuestos + o.mano_obra > 0
      and o.fecha_egreso >= (date_trunc('month', p_hasta::timestamp) - interval '11 months')::date and o.fecha_egreso <= p_hasta
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    -- Los totales incluyen gastos sin unidad (seguros, viáticos); los km salen de las unidades.
    'totales', jsonb_build_object(
        'costo', (select coalesce(sum(monto), 0) from costos),
        'km', (select coalesce(sum(km), 0) from por_unidad),
        'litros', (select coalesce(sum(litros), 0) from costos where categoria = 'combustible'),
        'combustible', (select coalesce(sum(monto), 0) from costos where categoria = 'combustible'),
        'mantenimiento', (select coalesce(sum(monto), 0) from costos where categoria = 'mantenimiento'),
        'viajes', (select count(*) from viajes_p),
        'fallas', (select count(*) from fallas f where f.organizacion_id = p_org and f.creada_en::date between p_desde and p_hasta)),
    'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'monto', total) order by total desc)
      from (select categoria, sum(monto) total from costos group by categoria) x), '[]'),
    'por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', m.mes, 'categorias',
        coalesce((select jsonb_object_agg(categoria, total) from (
          select c.categoria, sum(c.monto) total from costos_12 c where to_char(c.fecha, 'YYYY-MM') = m.mes group by c.categoria) y), '{}'))
        order by m.mes) from meses m), '[]'),
    'por_unidad', coalesce((select jsonb_agg(to_jsonb(p) order by p.costo desc, p.dominio) from por_unidad p), '[]'),
    'por_chofer', coalesce((select jsonb_agg(to_jsonb(p) order by p.gastos desc, p.nombre) from por_chofer p), '[]'),
    'fallas_por_sistema', coalesce((select jsonb_agg(jsonb_build_object('sistema', sistema, 'cantidad', n) order by n desc)
      from (select f.sistema, count(*) n from fallas f where f.organizacion_id = p_org and f.creada_en::date between p_desde and p_hasta
            group by f.sistema) z), '[]'),
    'ahora', jsonb_build_object(
      'unidades', (select count(*) from unidades where organizacion_id = p_org and estado <> 'baja'),
      'en_servicio', (select count(*) from unidades where organizacion_id = p_org and estado = 'operativa'),
      'en_taller', (select count(*) from unidades where organizacion_id = p_org and estado = 'taller'),
      'en_viaje', (select count(*) from viajes where organizacion_id = p_org and estado = 'en_curso'),
      'fallas_abiertas', (select count(*) from fallas where organizacion_id = p_org and estado in ('abierta', 'en_reparacion')),
      'fallas_criticas', (select count(*) from fallas where organizacion_id = p_org and estado in ('abierta', 'en_reparacion') and gravedad = 'critica'),
      'vencidos', (select count(*) from documentos where organizacion_id = p_org and vence < current_date),
      'por_vencer', (select count(*) from documentos where organizacion_id = p_org and vence between current_date and current_date + 30))
  ) into r;
  return r;
end $$;

-- ───────────── Permisos ─────────────
revoke execute on all functions in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Sólo se usa desde las operaciones del taller: nadie la llama directamente.
revoke execute on function public.liberar_unidad_si_corresponde(uuid) from authenticated;
