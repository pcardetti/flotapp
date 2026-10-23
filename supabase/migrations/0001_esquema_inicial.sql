-- Flota al Día · esquema inicial multiempresa
--
-- Cada empresa es una organización: una flota, un taller o una recapadora.
-- Los datos de una flota llevan su organizacion_id y sólo los ven sus miembros.
-- Talleres y recapadoras ven únicamente lo que la flota les asigna
-- (órdenes derivadas a ellos, neumáticos enviados a recapar) mientras el vínculo esté activo.
-- Las claves foráneas compuestas (id, organizacion_id) impiden mezclar datos de dos flotas.

-- ───────────── Tipos ─────────────
create type public.tipo_organizacion as enum ('flota', 'taller', 'recapadora');
create type public.rol_miembro as enum ('admin', 'jefe_taller', 'chofer', 'lectura', 'operario');
create type public.tipo_unidad as enum ('tractor', 'chasis', 'semirremolque', 'acoplado');
create type public.estado_unidad as enum ('operativa', 'taller', 'baja');
create type public.tipo_orden as enum ('preventivo', 'correctivo');
create type public.estado_orden as enum ('abierta', 'en_proveedor', 'cerrada');
create type public.estado_neumatico as enum ('montado', 'deposito', 'recapado', 'baja');
create type public.tipo_evento_neumatico as enum ('alta', 'montaje', 'desmontaje', 'rotacion', 'medicion', 'envio', 'recapado', 'rechazo', 'baja');
create type public.estado_vinculo as enum ('pendiente', 'activo', 'revocado');
create type public.aplica_documento as enum ('unidad', 'chofer');

-- ───────────── Organizaciones y personas ─────────────
create table public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  tipo public.tipo_organizacion not null,
  cuit text,
  creado_en timestamptz not null default now()
);

create table public.miembros (
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rol public.rol_miembro not null,
  chofer_id uuid,
  creado_en timestamptz not null default now(),
  primary key (organizacion_id, user_id)
);
create index on public.miembros (user_id);

create table public.vinculos_proveedor (
  id uuid primary key default gen_random_uuid(),
  flota_id uuid not null references public.organizaciones on delete cascade,
  proveedor_id uuid not null references public.organizaciones on delete cascade,
  estado public.estado_vinculo not null default 'pendiente',
  creado_en timestamptz not null default now(),
  unique (flota_id, proveedor_id),
  check (flota_id <> proveedor_id)
);
create index on public.vinculos_proveedor (proveedor_id);

-- ───────────── Funciones de acceso ─────────────
-- security definer: consultan miembros sin pasar por su propia política (evita recursión).
create function public.es_miembro(org uuid, roles public.rol_miembro[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros m
    where m.organizacion_id = org and m.user_id = auth.uid()
      and (roles is null or m.rol = any (roles))
  );
$$;

create function public.es_gestor(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_miembro(org, array['admin', 'jefe_taller']::rol_miembro[]);
$$;

create function public.es_operativo(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_miembro(org, array['admin', 'jefe_taller', 'chofer']::rol_miembro[]);
$$;

-- El usuario pertenece a un proveedor con vínculo activo con esta flota.
create function public.es_proveedor_de(flota uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vinculos_proveedor v
    join miembros m on m.organizacion_id = v.proveedor_id
    where v.flota_id = flota and v.estado = 'activo' and m.user_id = auth.uid()
  );
$$;

-- La organización está vinculada (en cualquier estado) con alguna organización del usuario.
create function public.es_contraparte(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vinculos_proveedor v
    join miembros m on m.user_id = auth.uid()
      and m.organizacion_id = case when v.flota_id = org then v.proveedor_id else v.flota_id end
    where (v.flota_id = org or v.proveedor_id = org) and v.estado <> 'revocado'
  );
$$;

create function public.vinculo_activo(flota uuid, proveedor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculos_proveedor where flota_id = flota and proveedor_id = proveedor and estado = 'activo');
$$;

-- ───────────── Datos de la flota ─────────────
create table public.choferes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  telefono text,
  creado_en timestamptz not null default now(),
  unique (id, organizacion_id)
);
create index on public.choferes (organizacion_id);

alter table public.miembros
  add foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id);

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  dominio text not null check (length(trim(dominio)) > 0),
  tipo public.tipo_unidad not null,
  marca text not null,
  modelo text not null,
  anio int check (anio between 1950 and 2100),
  km int check (km >= 0),
  jurisdiccion text not null default 'Nacional',
  estado public.estado_unidad not null default 'operativa',
  chofer_id uuid,
  cargas_peligrosas boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, dominio),
  unique (id, organizacion_id),
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id)
);

create table public.lecturas_km (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  km int not null check (km >= 0),
  fecha date not null default current_date,
  origen text not null default 'manual',
  user_id uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade
);
create index on public.lecturas_km (unidad_id, fecha);

create table public.tareas_plan (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  tarea text not null,
  cada_km int check (cada_km > 0),
  cada_dias int check (cada_dias > 0),
  ultimo_km int,
  ultima_fecha date not null default current_date,
  unique (id, organizacion_id),
  check (cada_km is not null or cada_dias is not null),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade
);
create index on public.tareas_plan (organizacion_id);

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  numero int not null,
  unidad_id uuid not null,
  tipo public.tipo_orden not null,
  descripcion text not null,
  proveedor_id uuid references public.organizaciones,
  taller_nombre text,
  estado public.estado_orden not null default 'abierta',
  fecha_ingreso date not null default current_date,
  fecha_egreso date,
  km int,
  repuestos numeric(14, 2) not null default 0,
  mano_obra numeric(14, 2) not null default 0,
  nota text,
  tarea_plan_id uuid,
  deja_fuera_servicio boolean not null default false,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (organizacion_id, numero),
  unique (id, organizacion_id),
  check (fecha_egreso is null or fecha_egreso >= fecha_ingreso),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id),
  foreign key (tarea_plan_id, organizacion_id) references public.tareas_plan (id, organizacion_id) on delete set null (tarea_plan_id)
);
create index on public.ordenes (proveedor_id) where proveedor_id is not null;

create table public.tipos_documento (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  nombre text not null,
  aplica public.aplica_documento not null,
  vigencia_meses int not null default 12 check (vigencia_meses > 0),
  aviso_dias int not null default 30 check (aviso_dias >= 0),
  nota text,
  unique (id, organizacion_id)
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  tipo_documento_id uuid not null,
  unidad_id uuid,
  chofer_id uuid,
  numero text,
  vence date not null,
  creado_en timestamptz not null default now(),
  check (num_nonnulls(unidad_id, chofer_id) = 1),
  foreign key (tipo_documento_id, organizacion_id) references public.tipos_documento (id, organizacion_id) on delete cascade,
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade,
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete cascade
);
create index on public.documentos (organizacion_id, vence);

-- Neumático: identidad propia (código) e historial que lo acompaña entre montajes y recapados.
create table public.neumaticos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones on delete cascade,
  codigo text not null check (length(trim(codigo)) > 0),
  marca text not null,
  medida text not null,
  profundidad numeric(4, 1) check (profundidad >= 0),
  recapados int not null default 0 check (recapados >= 0),
  precio numeric(14, 2) not null default 0,
  costo_total numeric(14, 2) not null default 0,
  km_total int not null default 0,
  km_vida int not null default 0,
  estado public.estado_neumatico not null default 'deposito',
  unidad_id uuid,
  posicion text,
  km_montaje int,
  fecha_montaje date,
  fecha_medicion date,
  proveedor_actual_id uuid references public.organizaciones,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, codigo),
  unique (id, organizacion_id),
  check ((estado = 'montado') = (unidad_id is not null and posicion is not null)),
  check ((estado = 'recapado') = (proveedor_actual_id is not null)),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id)
);
create unique index neumaticos_una_posicion on public.neumaticos (unidad_id, posicion) where estado = 'montado';
create index on public.neumaticos (proveedor_actual_id) where proveedor_actual_id is not null;

-- Historial inmutable: sin políticas de edición ni borrado.
create table public.neumatico_eventos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  neumatico_id uuid not null,
  tipo public.tipo_evento_neumatico not null,
  fecha date not null default current_date,
  detalle text,
  unidad_id uuid,
  posicion text,
  km int,
  profundidad numeric(4, 1),
  costo numeric(14, 2),
  proveedor_id uuid references public.organizaciones,
  user_id uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (neumatico_id, organizacion_id) references public.neumaticos (id, organizacion_id)
);
create index on public.neumatico_eventos (neumatico_id, creado_en);

create table public.controles_diarios (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  unidad_id uuid not null,
  chofer_id uuid,
  fecha date not null default current_date,
  km int check (km >= 0),
  items jsonb not null,
  observaciones text,
  orden_id uuid,
  user_id uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (unidad_id, organizacion_id) references public.unidades (id, organizacion_id) on delete cascade,
  foreign key (chofer_id, organizacion_id) references public.choferes (id, organizacion_id) on delete set null (chofer_id),
  foreign key (orden_id, organizacion_id) references public.ordenes (id, organizacion_id) on delete set null (orden_id)
);
create index on public.controles_diarios (organizacion_id, fecha);

create table public.configuracion (
  organizacion_id uuid primary key references public.organizaciones on delete cascade,
  aviso_km int not null default 2000,
  aviso_dias int not null default 15,
  profundidad_min numeric(4, 1) not null default 3
);

-- ───────────── Reglas de integridad ─────────────
create function public.validar_miembro() returns trigger language plpgsql security definer set search_path = public as $$
declare t tipo_organizacion;
begin
  select tipo into t from organizaciones where id = new.organizacion_id;
  if t = 'flota' and new.rol = 'operario' then
    raise exception 'El rol operario es sólo para talleres y recapadoras';
  elsif t <> 'flota' and new.rol not in ('admin', 'operario') then
    raise exception 'Un taller o recapadora sólo tiene roles admin u operario';
  end if;
  return new;
end $$;
create trigger miembros_validar before insert or update on public.miembros for each row execute function public.validar_miembro();

create function public.validar_vinculo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select tipo from organizaciones where id = new.flota_id) <> 'flota' then
    raise exception 'El vínculo debe partir de una flota';
  end if;
  if (select tipo from organizaciones where id = new.proveedor_id) = 'flota' then
    raise exception 'El proveedor tiene que ser un taller o una recapadora';
  end if;
  if tg_op = 'UPDATE' then
    if new.flota_id <> old.flota_id or new.proveedor_id <> old.proveedor_id then
      raise exception 'Un vínculo no cambia de flota ni de proveedor';
    end if;
    -- Sólo el proveedor acepta una invitación; la flota sólo puede revocar o volver a invitar.
    if new.estado = 'activo' and old.estado <> 'activo' and not es_miembro(new.proveedor_id, array['admin']::rol_miembro[]) then
      raise exception 'Sólo el proveedor puede aceptar el vínculo';
    end if;
    if new.estado = 'pendiente' and old.estado <> 'pendiente' and not es_miembro(new.flota_id, array['admin']::rol_miembro[]) then
      raise exception 'Sólo la flota puede volver a invitar';
    end if;
  end if;
  return new;
end $$;
create trigger vinculos_validar before insert or update on public.vinculos_proveedor for each row execute function public.validar_vinculo();

create function public.validar_proveedor_orden() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.proveedor_id is not null and (tg_op = 'INSERT' or new.proveedor_id is distinct from old.proveedor_id)
     and not public.vinculo_activo(new.organizacion_id, new.proveedor_id) then
    raise exception 'El taller no tiene un vínculo activo con esta flota';
  end if;
  return new;
end $$;
create trigger ordenes_validar_proveedor before insert or update on public.ordenes for each row execute function public.validar_proveedor_orden();

-- Número correlativo de orden por flota.
create function public.numerar_orden() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('ordenes:' || new.organizacion_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero from ordenes where organizacion_id = new.organizacion_id;
  return new;
end $$;
create trigger ordenes_numerar before insert on public.ordenes for each row execute function public.numerar_orden();

-- Una lectura de kilometraje mayor actualiza la unidad (el chofer no edita unidades directamente).
create function public.aplicar_lectura_km() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update unidades set km = new.km where id = new.unidad_id and coalesce(km, 0) < new.km;
  return new;
end $$;
create trigger lecturas_km_aplicar after insert on public.lecturas_km for each row execute function public.aplicar_lectura_km();

-- ───────────── Seguridad por fila ─────────────
alter table public.organizaciones enable row level security;
create policy organizaciones_leer on public.organizaciones for select to authenticated
  using (public.es_miembro(id) or public.es_contraparte(id));
create policy organizaciones_editar on public.organizaciones for update to authenticated
  using (public.es_miembro(id, array['admin']::rol_miembro[])) with check (public.es_miembro(id, array['admin']::rol_miembro[]));

alter table public.miembros enable row level security;
create policy miembros_leer on public.miembros for select to authenticated using (public.es_miembro(organizacion_id));
create policy miembros_crear on public.miembros for insert to authenticated with check (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));
create policy miembros_editar on public.miembros for update to authenticated
  using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[])) with check (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));
create policy miembros_borrar on public.miembros for delete to authenticated using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

alter table public.vinculos_proveedor enable row level security;
create policy vinculos_leer on public.vinculos_proveedor for select to authenticated
  using (public.es_miembro(flota_id) or public.es_miembro(proveedor_id));
create policy vinculos_crear on public.vinculos_proveedor for insert to authenticated
  with check (public.es_miembro(flota_id, array['admin']::rol_miembro[]) and estado = 'pendiente');
create policy vinculos_editar on public.vinculos_proveedor for update to authenticated
  using (public.es_miembro(flota_id, array['admin']::rol_miembro[]) or public.es_miembro(proveedor_id, array['admin']::rol_miembro[]));

-- Tablas internas de la flota: leen sus miembros, escriben admin y jefe de taller.
do $$
declare t text;
begin
  foreach t in array array['choferes', 'tareas_plan', 'tipos_documento', 'documentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_miembro(organizacion_id))', t || '_leer', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_gestor(organizacion_id))', t || '_crear', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id))', t || '_editar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_gestor(organizacion_id))', t || '_borrar', t);
  end loop;
end $$;

alter table public.unidades enable row level security;
create policy unidades_leer on public.unidades for select to authenticated
  using (public.es_miembro(organizacion_id) or public.es_proveedor_de(organizacion_id));
create policy unidades_crear on public.unidades for insert to authenticated with check (public.es_gestor(organizacion_id));
create policy unidades_editar on public.unidades for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));
create policy unidades_borrar on public.unidades for delete to authenticated using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

alter table public.lecturas_km enable row level security;
create policy lecturas_leer on public.lecturas_km for select to authenticated using (public.es_miembro(organizacion_id));
create policy lecturas_crear on public.lecturas_km for insert to authenticated with check (public.es_operativo(organizacion_id));

alter table public.ordenes enable row level security;
create policy ordenes_leer on public.ordenes for select to authenticated
  using (public.es_miembro(organizacion_id) or (proveedor_id is not null and public.es_miembro(proveedor_id)));
create policy ordenes_crear on public.ordenes for insert to authenticated with check (public.es_gestor(organizacion_id));
create policy ordenes_editar on public.ordenes for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));
create policy ordenes_borrar on public.ordenes for delete to authenticated using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

alter table public.neumaticos enable row level security;
create policy neumaticos_leer on public.neumaticos for select to authenticated
  using (public.es_miembro(organizacion_id) or (proveedor_actual_id is not null and public.es_miembro(proveedor_actual_id)));
create policy neumaticos_crear on public.neumaticos for insert to authenticated with check (public.es_gestor(organizacion_id));
create policy neumaticos_editar on public.neumaticos for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));

alter table public.neumatico_eventos enable row level security;
create policy eventos_leer on public.neumatico_eventos for select to authenticated
  using (exists (select 1 from public.neumaticos n where n.id = neumatico_id));
create policy eventos_crear on public.neumatico_eventos for insert to authenticated with check (public.es_gestor(organizacion_id));

alter table public.controles_diarios enable row level security;
create policy controles_leer on public.controles_diarios for select to authenticated using (public.es_miembro(organizacion_id));
create policy controles_crear on public.controles_diarios for insert to authenticated with check (public.es_operativo(organizacion_id));
create policy controles_editar on public.controles_diarios for update to authenticated
  using (public.es_gestor(organizacion_id)) with check (public.es_gestor(organizacion_id));
create policy controles_borrar on public.controles_diarios for delete to authenticated using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

alter table public.configuracion enable row level security;
create policy configuracion_leer on public.configuracion for select to authenticated using (public.es_miembro(organizacion_id));
create policy configuracion_editar on public.configuracion for update to authenticated
  using (public.es_miembro(organizacion_id, array['admin']::rol_miembro[])) with check (public.es_miembro(organizacion_id, array['admin']::rol_miembro[]));

-- ───────────── Operaciones ─────────────
-- Crea una empresa y deja al usuario como administrador.
create function public.crear_organizacion(p_nombre text, p_tipo public.tipo_organizacion)
returns uuid language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  insert into organizaciones (nombre, tipo) values (p_nombre, p_tipo) returning id into org;
  insert into miembros (organizacion_id, user_id, rol) values (org, auth.uid(), 'admin');
  if p_tipo = 'flota' then
    insert into configuracion (organizacion_id) values (org);
    insert into tipos_documento (organizacion_id, nombre, aplica, vigencia_meses, aviso_dias, nota) values
      (org, 'RTO (Revisión Técnica Obligatoria)', 'unidad', 12, 30, 'Ley 24.449, art. 34. Verificá el plazo vigente para tu jurisdicción.'),
      (org, 'Seguro de responsabilidad civil', 'unidad', 12, 30, null),
      (org, 'Control del tacógrafo', 'unidad', 12, 30, 'Ley 24.449, art. 53 inc. g.'),
      (org, 'Licencia de conducir profesional', 'chofer', 12, 30, null),
      (org, 'Curso de cargas peligrosas', 'chofer', 12, 30, null);
  end if;
  return org;
end $$;

-- Km recorridos en el montaje actual (0 si la unidad no tiene odómetro).
create function public.neumatico_km_actual(n public.neumaticos)
returns int language sql stable set search_path = public as $$
  select coalesce((
    select case when n.estado = 'montado' and n.km_montaje is not null and u.km is not null and u.tipo in ('tractor', 'chasis')
                then greatest(0, u.km - n.km_montaje) else 0 end
    from unidades u where u.id = n.unidad_id), 0);
$$;

create function public.neumatico_alta(p_org uuid, p_codigo text, p_marca text, p_medida text, p_profundidad numeric,
  p_recapados int default 0, p_precio numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare nid uuid;
begin
  insert into neumaticos (organizacion_id, codigo, marca, medida, profundidad, recapados, precio, costo_total, fecha_medicion)
  values (p_org, upper(trim(p_codigo)), p_marca, p_medida, p_profundidad, coalesce(p_recapados, 0), coalesce(p_precio, 0), coalesce(p_precio, 0), current_date)
  returning id into nid;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, profundidad, costo)
  values (p_org, nid, 'alta', p_marca || ' ' || p_medida, p_profundidad, nullif(p_precio, 0));
  return nid;
end $$;

create function public.neumatico_montar(p_neumatico uuid, p_unidad uuid, p_posicion text)
returns void language plpgsql set search_path = public as $$
declare n neumaticos; u unidades;
begin
  select * into n from neumaticos where id = p_neumatico for update;
  if n.id is null then raise exception 'Neumático no encontrado'; end if;
  if n.estado <> 'deposito' then raise exception 'Sólo se montan neumáticos que están en el depósito'; end if;
  select * into u from unidades where id = p_unidad and organizacion_id = n.organizacion_id;
  if u.id is null then raise exception 'Unidad no encontrada'; end if;
  update neumaticos set estado = 'montado', unidad_id = u.id, posicion = p_posicion,
    km_montaje = case when u.tipo in ('tractor', 'chasis') then u.km end, fecha_montaje = current_date
  where id = n.id;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, unidad_id, posicion, km)
  values (n.organizacion_id, n.id, 'montaje', 'Montado en ' || u.dominio || ' · ' || p_posicion, u.id, p_posicion, u.km);
end $$;

-- Mueve un neumático montado. Si la posición destino está ocupada en la misma unidad, los intercambia.
create function public.neumatico_mover(p_neumatico uuid, p_unidad uuid, p_posicion text)
returns void language plpgsql set search_path = public as $$
declare n neumaticos; o neumaticos; u unidades; uo unidades; seg_n int; seg_o int;
begin
  select * into n from neumaticos where id = p_neumatico for update;
  if n.estado <> 'montado' then raise exception 'El neumático no está montado'; end if;
  select * into u from unidades where id = p_unidad and organizacion_id = n.organizacion_id;
  select * into uo from unidades where id = n.unidad_id;
  if u.id is null then raise exception 'Unidad no encontrada'; end if;
  select * into o from neumaticos where unidad_id = u.id and posicion = p_posicion and estado = 'montado' for update;
  if o.id is not null and o.unidad_id <> n.unidad_id then
    raise exception 'La posición % de % está ocupada', p_posicion, u.dominio;
  end if;
  seg_n := neumatico_km_actual(n);
  if o.id is not null then
    seg_o := neumatico_km_actual(o);
    update neumaticos set posicion = '~' || id::text where id = o.id;
  end if;
  update neumaticos set unidad_id = u.id, posicion = p_posicion, km_total = km_total + seg_n, km_vida = km_vida + seg_n,
    km_montaje = case when u.tipo in ('tractor', 'chasis') then u.km end, fecha_montaje = current_date
  where id = n.id;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, unidad_id, posicion, km)
  values (n.organizacion_id, n.id, 'rotacion', 'De ' || uo.dominio || ' ' || n.posicion || ' a ' || u.dominio || ' ' || p_posicion, u.id, p_posicion, u.km);
  if o.id is not null then
    update neumaticos set posicion = n.posicion, km_total = km_total + seg_o, km_vida = km_vida + seg_o,
      km_montaje = case when uo.tipo in ('tractor', 'chasis') then uo.km end, fecha_montaje = current_date
    where id = o.id;
    insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, unidad_id, posicion, km)
    values (o.organizacion_id, o.id, 'rotacion', 'Intercambio con ' || n.codigo || ': de ' || u.dominio || ' ' || p_posicion || ' a ' || uo.dominio || ' ' || n.posicion, uo.id, n.posicion, uo.km);
  end if;
end $$;

-- Saca un neumático del camión o del depósito: al depósito, a una recapadora vinculada o de baja.
create function public.neumatico_sacar(p_neumatico uuid, p_destino public.estado_neumatico, p_proveedor uuid default null,
  p_motivo text default null, p_profundidad numeric default null)
returns void language plpgsql set search_path = public as $$
declare n neumaticos; u unidades; seg int; prov_nombre text;
begin
  select * into n from neumaticos where id = p_neumatico for update;
  if n.id is null then raise exception 'Neumático no encontrado'; end if;
  if p_destino = 'montado' then raise exception 'Para montar usá neumatico_montar'; end if;
  if n.estado in ('recapado', 'baja') then raise exception 'El neumático no está disponible'; end if;
  if p_destino = 'deposito' and n.estado <> 'montado' then raise exception 'Ya está en el depósito'; end if;
  if p_destino = 'recapado' then
    if p_proveedor is null or not vinculo_activo(n.organizacion_id, p_proveedor)
       or (select tipo from organizaciones where id = p_proveedor) <> 'recapadora' then
      raise exception 'Elegí una recapadora con vínculo activo';
    end if;
    select nombre into prov_nombre from organizaciones where id = p_proveedor;
  end if;
  select * into u from unidades where id = n.unidad_id;
  seg := neumatico_km_actual(n);
  update neumaticos set estado = p_destino, unidad_id = null, posicion = null, km_montaje = null,
    km_total = km_total + seg, km_vida = km_vida + seg,
    profundidad = coalesce(p_profundidad, profundidad),
    proveedor_actual_id = case when p_destino = 'recapado' then p_proveedor end
  where id = n.id;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, unidad_id, posicion, km, profundidad, proveedor_id)
  values (n.organizacion_id, n.id,
    case p_destino when 'baja' then 'baja' when 'recapado' then 'envio' else 'desmontaje' end::tipo_evento_neumatico,
    concat_ws(' · ', case when u.id is not null then 'Desde ' || u.dominio || ' ' || n.posicion end, prov_nombre, p_motivo,
      case when seg > 0 then seg || ' km en este montaje' end),
    u.id, n.posicion, u.km, p_profundidad, p_proveedor);
end $$;

create function public.neumatico_medir(p_neumatico uuid, p_profundidad numeric)
returns void language plpgsql set search_path = public as $$
declare n neumaticos;
begin
  update neumaticos set profundidad = p_profundidad, fecha_medicion = current_date where id = p_neumatico returning * into n;
  if n.id is null then raise exception 'Neumático no encontrado'; end if;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, unidad_id, posicion, profundidad)
  values (n.organizacion_id, n.id, 'medicion', p_profundidad || ' mm', n.unidad_id, n.posicion, p_profundidad);
end $$;

-- Lado de la recapadora: sólo sobre neumáticos que le enviaron.
create function public.recapadora_recibir(p_neumatico uuid, p_profundidad numeric, p_costo numeric)
returns void language plpgsql security definer set search_path = public as $$
declare n neumaticos;
begin
  select * into n from neumaticos where id = p_neumatico for update;
  if n.id is null or n.estado <> 'recapado' or not es_miembro(n.proveedor_actual_id) then
    raise exception 'Neumático no encontrado';
  end if;
  update neumaticos set estado = 'deposito', recapados = recapados + 1, km_vida = 0, profundidad = p_profundidad,
    fecha_medicion = current_date, costo_total = costo_total + coalesce(p_costo, 0), proveedor_actual_id = null
  where id = n.id;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, profundidad, costo, proveedor_id)
  values (n.organizacion_id, n.id, 'recapado',
    'Vida ' || (n.recapados + 2) || ' · ' || (select nombre from organizaciones where id = n.proveedor_actual_id),
    p_profundidad, p_costo, n.proveedor_actual_id);
end $$;

create function public.recapadora_rechazar(p_neumatico uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare n neumaticos;
begin
  select * into n from neumaticos where id = p_neumatico for update;
  if n.id is null or n.estado <> 'recapado' or not es_miembro(n.proveedor_actual_id) then
    raise exception 'Neumático no encontrado';
  end if;
  update neumaticos set estado = 'deposito', proveedor_actual_id = null where id = n.id;
  insert into neumatico_eventos (organizacion_id, neumatico_id, tipo, detalle, proveedor_id)
  values (n.organizacion_id, n.id, 'rechazo', 'No recapable · ' || coalesce(p_motivo, 'sin motivo'), n.proveedor_actual_id);
end $$;

-- Lado del taller: informa avance y costos de las órdenes derivadas a él.
create function public.taller_actualizar_orden(p_orden uuid, p_estado public.estado_orden, p_repuestos numeric,
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
    nota = coalesce(p_nota, nota), fecha_egreso = case when p_estado = 'cerrada' then coalesce(p_fecha_egreso, current_date) end
  where id = o.id;
end $$;

-- ───────────── Permisos ─────────────
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
