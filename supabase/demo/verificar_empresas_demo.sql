-- Flotapp · revisa las empresas de muestra como las vería cada persona al entrar, sin cambiar nada.
-- Se ejecuta en Supabase → SQL Editor después de empresas_demo.sql. Cada fila es una prueba y tiene que decir "ok".
-- Para entrar como cada cuenta usa el rol "authenticated" con su usuario, igual que la app: pasa por todas las
-- políticas de seguridad de la base.

drop table if exists demo_control;
create temp table demo_control (n serial, empresa text, cuenta text, prueba text, resultado text, detalle text);

do $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_desde date;
  c record;
  v_otra uuid;
  v_t jsonb;
  a int; b int; v int; w int;
  v_ok boolean;
  v_t0 timestamptz; v_ms numeric;
  -- Resultados de la cuenta (prueba, resultado y detalle seguidos), que se anotan al volver al rol de la base.
  v_res text[];
begin
  v_desde := date_trunc('month', v_hoy)::date;

  -- ───────────── Reglas de los datos (como administrador de la base) ─────────────
  select count(*) into a from (
    select km < lag(km) over (partition by unidad_id order by creado_en, km) baja from public.lecturas_km where organizacion_id::text like 'de000000-%') x where baja;
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'El kilometraje de cada unidad nunca baja', case when a = 0 then 'ok' else 'FALLA' end, a || ' lecturas fuera de orden');
  select count(*) into a from (
    select vi.unidad_id from public.viajes vi where vi.organizacion_id::text like 'de000000-%' and vi.estado = 'en_curso' group by vi.unidad_id having count(*) > 1) x;
  select count(*) into b from (
    select vi.user_id from public.viajes vi where vi.organizacion_id::text like 'de000000-%' and vi.estado = 'en_curso' group by vi.user_id having count(*) > 1) x;
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'Como mucho un viaje en curso por unidad y por persona', case when a + b = 0 then 'ok' else 'FALLA' end, a + b || ' repetidos');
  select count(*) into a from public.viajes v1 join public.viajes v2 on v2.unidad_id = v1.unidad_id and v2.id <> v1.id
    and v2.inicio < coalesce(v1.fin, now()) and coalesce(v2.fin, now()) > v1.inicio
  where v1.organizacion_id::text like 'de000000-%';
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'Ninguna unidad está en dos viajes a la vez', case when a = 0 then 'ok' else 'FALLA' end, a || ' superposiciones');
  select count(*) into a from public.unidades u where u.organizacion_id::text like 'de000000-%' and u.tipo in ('tractor', 'chasis') and u.estado <> 'baja'
    and (select count(*) from public.neumaticos n where n.unidad_id = u.id and n.estado = 'montado') <> 6;
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'Cada unidad de tracción tiene sus 6 cubiertas montadas', case when a = 0 then 'ok' else 'FALLA' end, a || ' unidades distintas');
  select count(*) into a from (
    select o.numero < lag(o.numero) over (partition by o.organizacion_id order by o.fecha_ingreso, o.creado_en, o.numero) desordenada
    from public.ordenes o where o.organizacion_id::text like 'de000000-%') x where desordenada;
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'Las órdenes de trabajo van numeradas por fecha', case when a = 0 then 'ok' else 'FALLA' end, a || ' fuera de orden');
  select count(*) into a from public.unidades u where u.organizacion_id::text like 'de000000-%' and u.estado = 'taller'
    and not exists (select 1 from public.ordenes o where o.unidad_id = u.id and o.estado <> 'cerrada');
  select count(*) into b from public.fallas f where f.organizacion_id::text like 'de000000-%' and f.estado = 'en_reparacion'
    and not exists (select 1 from public.ordenes o where o.id = f.orden_id and o.estado <> 'cerrada');
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'Lo que está en el taller tiene su orden abierta', case when a + b = 0 then 'ok' else 'FALLA' end, a || ' unidades y ' || b || ' fallas sin orden');
  select count(*) into a from public.auditoria x join public.ordenes o on o.id::text = x.recurso_id
  where x.organizacion_id::text like 'de000000-%' and x.accion = 'orden.cerrada' and x.creado_en > now() - interval '1 minute' and o.fecha_egreso < v_hoy;
  insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values ('Todas', '—', 'La actividad muestra cada trabajo en su fecha', case when a = 0 then 'ok' else 'FALLA' end, a || ' con la hora de la carga');

  -- ───────────── Cada cuenta, con sus permisos ─────────────
  for c in
    select u.id, u.email, m.organizacion_id org, m.rol::text rol, o.nombre, o.tipo::text tipo
    from auth.users u join public.miembros m on m.user_id = u.id join public.organizaciones o on o.id = m.organizacion_id
    where u.email like '%@flotapp.test' order by o.id, m.rol, u.email
  loop
    v_res := array[]::text[];
    v_otra := (select id from public.organizaciones where id::text like 'de000000-%' and tipo = 'flota' and id <> c.org order by id limit 1);
    perform set_config('request.jwt.claim.sub', c.id::text, true);
    execute 'set local role authenticated';

    -- Empresas y unidades que ve.
    select count(*), count(*) filter (where id = c.org) into a, b from public.organizaciones;
    select count(*) into v from public.vinculos_proveedor where (flota_id = c.org or proveedor_id = c.org) and estado <> 'revocado';
    v_res := v_res || array['Ve su empresa y sólo las vinculadas', case when b = 1 and a = 1 + v then 'ok' else 'FALLA' end, a || ' empresas visibles'];
    select count(*), count(*) filter (where organizacion_id = c.org) into a, b from public.unidades;

    if c.tipo = 'flota' then
      v_res := v_res || array['Ve sólo las unidades de su flota', case when a = b and a > 0 then 'ok' else 'FALLA' end, a || ' unidades'];
      begin
        v_t0 := clock_timestamp();
        v_t := public.tablero(c.org, v_desde, v_hoy);
        v_ms := round(extract(epoch from clock_timestamp() - v_t0) * 1000);
        if c.rol in ('admin', 'jefe_taller', 'lectura') then
          v_ok := (v_t #>> '{totales,km}')::numeric > 0 and (v_t #>> '{totales,litros}')::numeric > 0
            and (v_t #>> '{totales,litros}')::numeric / (v_t #>> '{totales,km}')::numeric * 100 between 15 and 45;
          v_res := v_res || array['Tablero del mes con km, costos y consumo', case when v_ok then 'ok' else 'FALLA' end,
            to_char((v_t #>> '{totales,km}')::numeric, 'FM999G999G999') || ' km · costo $ ' || to_char((v_t #>> '{totales,costo}')::numeric, 'FM999G999G999')
            || ' · combustible $ ' || to_char((v_t #>> '{totales,combustible}')::numeric, 'FM999G999G999') || ' · '
            || round((v_t #>> '{totales,litros}')::numeric / nullif((v_t #>> '{totales,km}')::numeric, 0) * 100, 1) || ' l/100 km · se calculó en ' || v_ms || ' ms'];
          v_res := v_res || array['Costos por mes con historia', case when (select count(*) from jsonb_array_elements(v_t -> 'por_mes') x where x -> 'categorias' <> '{}'::jsonb) >= 5 then 'ok' else 'FALLA' end,
            (select count(*) from jsonb_array_elements(v_t -> 'por_mes') x where x -> 'categorias' <> '{}'::jsonb) || ' meses con gastos'];
          v_res := v_res || array['Ahora: en viaje, en taller y vencimientos',
            case when (v_t #>> '{ahora,en_taller}')::int >= 1 and (v_t #>> '{ahora,vencidos}')::int + (v_t #>> '{ahora,por_vencer}')::int >= 2 then 'ok' else 'FALLA' end,
            (v_t #>> '{ahora,en_viaje}') || ' en viaje · ' || (v_t #>> '{ahora,en_taller}') || ' en taller · ' || (v_t #>> '{ahora,vencidos}') || ' vencidos · '
            || (v_t #>> '{ahora,por_vencer}') || ' por vencer · ' || (v_t #>> '{ahora,fallas_abiertas}') || ' fallas abiertas'];
        else
          v_res := v_res || array['No ve el tablero', 'FALLA', 'lo vio'];
        end if;
      exception when others then
        v_res := v_res || array[case when c.rol in ('admin', 'jefe_taller', 'lectura') then 'Tablero del mes con km, costos y consumo' else 'No ve el tablero' end,
          case when c.rol in ('admin', 'jefe_taller', 'lectura') then 'FALLA' else 'ok' end, sqlerrm];
      end;
      begin
        v_t := public.tablero(v_otra, v_desde, v_hoy);
        v_res := v_res || array['No ve el tablero de otra flota', 'FALLA', 'lo vio'];
      exception when others then
        v_res := v_res || array['No ve el tablero de otra flota', 'ok', sqlerrm];
      end;
      select count(*), count(*) filter (where cargado_por = c.id) into a, b from public.gastos;
      select count(*), count(*) filter (where user_id = c.id) into v, w from public.viajes;
      if c.rol = 'chofer' then
        v_res := v_res || array['El chofer ve sólo sus viajes', case when v = w and v > 0 then 'ok' else 'FALLA' end, v || ' viajes'];
        v_res := v_res || array['El chofer ve sólo los gastos que cargó', case when a = b and a > 0 then 'ok' else 'FALLA' end, a || ' gastos'];
      elsif c.rol = 'mecanico' then
        v_res := v_res || array['El mecánico no ve los gastos', case when a = 0 then 'ok' else 'FALLA' end, a || ' gastos'];
        select count(*) into a from public.fallas;
        select count(*) into b from public.ordenes;
        v_res := v_res || array['El mecánico ve fallas y órdenes', case when a > 0 and b > 0 then 'ok' else 'FALLA' end, a || ' fallas · ' || b || ' órdenes'];
      else
        v_res := v_res || array['Ve los gastos y viajes de toda la flota', case when a > 0 and v > 0 and v > w then 'ok' else 'FALLA' end, a || ' gastos · ' || v || ' viajes'];
      end if;
      if c.rol = 'admin' then
        v_res := v_res || array['Suscripción activa con sus pagos',
          case when public.estado_cuenta(c.org) = 'activa' and jsonb_array_length(public.mi_suscripcion(c.org) -> 'pagos') >= 5 then 'ok' else 'FALLA' end,
          (public.mi_suscripcion(c.org) ->> 'nombre_plan') || ' · ' || (public.mi_suscripcion(c.org) ->> 'unidades') || ' de '
          || coalesce(public.mi_suscripcion(c.org) ->> 'max_unidades', 'sin tope') || ' unidades'];
        select count(*), count(*) filter (where organizacion_id = c.org) into a, b from public.auditoria;
        v_res := v_res || array['Ve la actividad de su empresa y de ninguna otra', case when a = b and a > 0 then 'ok' else 'FALLA' end, a || ' eventos'];
      end if;
    elsif c.tipo = 'taller' then
      select count(*), count(*) filter (where proveedor_id = c.org) into v, w from public.ordenes;
      v_res := v_res || array['El taller ve sólo los trabajos que le derivaron', case when v = w and v > 0 then 'ok' else 'FALLA' end, v || ' órdenes'];
      select count(*) into w from public.unidades u where not exists (
        select 1 from public.vinculos_proveedor vp where vp.flota_id = u.organizacion_id and vp.proveedor_id = c.org and vp.estado = 'activo');
      v_res := v_res || array['Ve sólo unidades de las flotas vinculadas', case when w = 0 and a > 0 then 'ok' else 'FALLA' end, a || ' unidades'];
      select count(*) into a from public.gastos;
      v_res := v_res || array['No ve gastos de las flotas', case when a = 0 then 'ok' else 'FALLA' end, a || ' gastos'];
    else
      select count(*), count(*) filter (where proveedor_actual_id = c.org) into v, w from public.neumaticos;
      v_res := v_res || array['La recapadora ve sólo las cubiertas que le mandaron', case when v = w and v > 0 then 'ok' else 'FALLA' end, v || ' cubiertas'];
    end if;

    execute 'reset role';
    for a in 0 .. coalesce(array_length(v_res, 1), 0) / 3 - 1 loop
      insert into demo_control (empresa, cuenta, prueba, resultado, detalle) values (c.nombre, c.email, v_res[a * 3 + 1], v_res[a * 3 + 2], v_res[a * 3 + 3]);
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

select empresa, cuenta, prueba, resultado, detalle from demo_control order by (resultado = 'ok'), n;
