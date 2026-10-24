-- Pedidos de contratación que llegan desde la página de inicio (empresa, contacto, unidades y plan).
-- Quedan guardados para contactar a cada empresa y darla de alta. Nadie los lee por la API: se ven en
-- Supabase → Table Editor → solicitudes. Se ejecuta una sola vez, después de la 0004.

create table public.solicitudes (
  id bigint generated always as identity primary key,
  empresa text not null check (char_length(empresa) between 2 and 120),
  nombre text not null check (char_length(nombre) between 2 and 80),
  email text not null check (char_length(email) <= 160 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefono text not null check (char_length(telefono) between 8 and 30),
  unidades int not null check (unidades between 1 and 5000),
  plan text not null check (char_length(plan) between 1 and 40),
  comentario text check (char_length(comentario) <= 1000),
  -- Seguimiento a mano desde el Table Editor.
  estado text not null default 'nueva' check (estado in ('nueva', 'contactada', 'alta', 'descartada')),
  ip text,
  agente text,
  creada_en timestamptz not null default now()
);
create index on public.solicitudes (creada_en desc);
alter table public.solicitudes enable row level security;

-- La única forma de escribir: valida lo mismo que la tabla y anota desde dónde llegó el pedido.
create function public.solicitar_contratacion(
  p_empresa text, p_nombre text, p_email text, p_telefono text, p_unidades int, p_plan text, p_comentario text default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_cabeceras json := nullif(current_setting('request.headers', true), '')::json;
  v_id bigint;
begin
  insert into solicitudes (empresa, nombre, email, telefono, unidades, plan, comentario, ip, agente)
  values (
    trim(p_empresa), trim(p_nombre), lower(trim(p_email)), trim(p_telefono), p_unidades, p_plan,
    nullif(trim(coalesce(p_comentario, '')), ''),
    left(v_cabeceras ->> 'x-flotapp-ip', 64), left(v_cabeceras ->> 'x-flotapp-agente', 300)
  )
  returning id into v_id;
  return v_id;
end $$;

-- Límite de pedidos: se suma a los del ingreso y el registro (5 por hora desde la misma conexión).
create or replace function public.consumir_intento(p_accion text, p_clave text)
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
    ('registro_ip', 10, interval '1 hour'),
    ('contacto_ip', 5, interval '1 hour')
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

-- ───────────── Permisos ─────────────
revoke all on table public.solicitudes from anon, authenticated;
revoke execute on function public.solicitar_contratacion(text, text, text, text, int, text, text) from public;
grant execute on function public.solicitar_contratacion(text, text, text, text, int, text, text) to anon, authenticated;
