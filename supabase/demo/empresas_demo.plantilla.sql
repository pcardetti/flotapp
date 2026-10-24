-- Flotapp · empresas de muestra para mostrar la app
-- 8 flotas, un taller y una recapadora. Cada flota tiene 20 días de actividad diaria (viajes con chequeo, combustible,
-- peajes, viáticos, fallas, órdenes de trabajo y cambios de cubiertas) y 5 meses de historia (cargas en la base, gastos
-- fijos y services) para que los gráficos de costos tengan tendencia.
-- Se ejecuta una sola vez en Supabase → SQL Editor, con las migraciones al día. Si algo falla, no queda nada a medias.
-- Para sacarlo todo: borrar_empresas_demo.sql. Las cuentas usan mails @flotapp.test, que no reciben correo.
-- Esta es la plantilla: armar.mjs le pone la clave y genera empresas_demo.sql y usuarios-demo.md.

create or replace function pg_temp.entre(a numeric, b numeric) returns numeric language sql volatile as $$ select a + random()::numeric * (b - a) $$;
create or replace function pg_temp.ent(a int, b int) returns int language sql volatile as $$ select a + floor(random() * (b - a + 1))::int $$;
create or replace function pg_temp.uno(x text[]) returns text language sql volatile as $$ select x[1 + floor(random() * array_length(x, 1))::int] $$;
create or replace function pg_temp.momento(d date, horas numeric) returns timestamptz language sql stable as $$
  select (d::timestamp + make_interval(secs => (horas * 3600)::double precision)) at time zone 'America/Argentina/Buenos_Aires' $$;
create or replace function pg_temp.dia(t timestamptz) returns date language sql stable as $$ select (t at time zone 'America/Argentina/Buenos_Aires')::date $$;
create or replace function pg_temp.org(n int) returns uuid language sql immutable as $$ select ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.cuenta(n int) returns uuid language sql immutable as $$ select ('de00a000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- Los choferes sin cuenta firman sus viajes y gastos con un usuario ficticio fijo (esas columnas no apuntan a auth.users).
create or replace function pg_temp.fantasma(chofer uuid) returns uuid language sql immutable as $$ select md5('demo-chofer-' || chofer::text)::uuid $$;
-- Precios con 2,2 % de inflación mensual hacia atrás.
create or replace function pg_temp.precio(base numeric, d date, hoy date) returns numeric language sql immutable as $$ select base * power(1.022, (d - hoy) / 30.0) $$;
create or replace function pg_temp.plata(x numeric, paso numeric) returns numeric language sql immutable as $$ select round(x / paso) * paso $$;
create or replace function pg_temp.patente(anio int) returns text language sql volatile as $$
  select case when anio <= 2015
    then substr('KLMNOP', least(6, greatest(1, anio - 2009)), 1) || substr('ABCDEFGHJKLMNPRSTUVWXYZ', pg_temp.ent(1, 23), 1)
         || substr('ABCDEFGHJKLMNPRSTUVWXYZ', pg_temp.ent(1, 23), 1) || ' ' || pg_temp.ent(100, 999)
    else 'A' || substr('ABCDEFGH', least(8, greatest(1, anio - 2015)), 1) || ' ' || pg_temp.ent(100, 999) || ' '
         || substr('ABCDEFGHJKLMNPRSTUVWXYZ', pg_temp.ent(1, 23), 1) || substr('ABCDEFGHJKLMNPRSTUVWXYZ', pg_temp.ent(1, 23), 1)
  end $$;

do $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  h0 date;  -- empieza la historia
  d0 date;  -- empieza la actividad diaria
  v_clave constant text := ':CLAVE:';

  nombres text[] := array['Juan','Carlos','Jorge','Luis','Miguel','Ricardo','Daniel','Sergio','Marcelo','Gustavo','Diego','Pablo','Martín',
    'Walter','Hugo','Raúl','Oscar','Fernando','Claudio','Héctor','Ramón','Mario','Alberto','Rubén','Darío','Leandro','Matías','Gabriel',
    'Federico','Ezequiel','Cristian','Nicolás','Fabián','Rodolfo','Néstor','Omar','Julio','Ariel','Mauricio','Gonzalo'];
  apellidos text[] := array['González','Rodríguez','Gómez','Fernández','López','Díaz','Martínez','Pérez','Romero','Sosa','Álvarez','Torres',
    'Ruiz','Ramírez','Flores','Acosta','Benítez','Medina','Herrera','Suárez','Aguirre','Giménez','Gutiérrez','Pereyra','Molina','Castro',
    'Ortiz','Silva','Núñez','Luna','Juárez','Cabrera','Ríos','Ferreyra','Godoy','Morales','Domínguez','Moreno','Peralta','Vega'];
  m_tractor text[] := array['Scania|R 450','Scania|G 410','Mercedes-Benz|Actros 2045','Mercedes-Benz|Axor 2041','Volvo|FH 460','Iveco|Hi-Way 480',
    'Volkswagen|Constellation 19.420','DAF|XF 480'];
  m_chasis text[] := array['Mercedes-Benz|Atego 1726','Volkswagen|Constellation 17.280','Iveco|Tector 170E28','Ford|Cargo 1723'];
  m_liviano text[] := array['Volkswagen|Delivery 11.180','Mercedes-Benz|Accelo 1016','Iveco|Daily 70C17','Ford|Cargo 1119'];
  m_semi text[] := array['Helvética|Sider 3 ejes','Montenegro|Furgón térmico 3 ejes','Sola y Brusa|Batea 3 ejes','Bonano|Tolva cerealera 3 ejes','Randon|Sider 3 ejes'];
  m_acoplado text[] := array['Vulcano|Acoplado cerealero 2 ejes','Bonano|Acoplado playo 2 ejes','Montenegro|Acoplado furgón 2 ejes'];
  cubiertas text[] := array['Michelin X Multi Z','Bridgestone R268','Pirelli FR85','Firestone FS591','Fate Sansei','Goodyear KMAX S'];
  posiciones text[] := array['Delantero izq','Delantero der','Tracción izq ext','Tracción izq int','Tracción der int','Tracción der ext'];
  estaciones text[] := array['YPF','Shell','Axion','Puma'];
  aseguradoras text[] := array['La Segunda','Federación Patronal','Sancor Seguros','Rivadavia Seguros'];
  leves text[] := array['niveles','perdidas','visibilidad','seguridad','documentacion'];
  criticos text[] := array['frenos','direccion','neumaticos','luces'];
  en_ruta text[] := array['motor','electricidad','luces','neumaticos','perdidas','carroceria'];

  e record; u record; r record; t record;
  v_org uuid; v_admin uuid; v_jefe uuid; v_mecs uuid[]; v_mec uuid;
  v_taller uuid; v_recap uuid; v_tipos uuid[]; v_tarea uuid;
  v_choferes uuid[]; v_chofer uuid; v_reserva uuid; v_login_chofer uuid; v_usr uuid; v_ch uuid; v_us uuid;
  v_ok_tractor jsonb; v_ok_chasis jsonb; v_items jsonb;
  i int; j int; k int; n_tr int; v_idx int; d date; x date; p numeric;
  v_dom text; v_anio int; v_mm text[]; v_id uuid; v_km int; v_dist int; v_km_ini int;
  v_tasa numeric; v_acc numeric; v_umbral numeric; v_litros numeric; v_servicio int; v_libre date;
  v_semana_viajes int; v_crit date; v_crit_abierta boolean; v_externo date; v_en_curso_forzado boolean;
  v_ini timestamptz; v_fin timestamptz; v_ult_fin timestamptz; v_chequeo uuid; v_viaje uuid; v_falla uuid; v_dur int;
  v_sis text; v_destino text; v_seq int; v_medida text; v_marca text; v_precio numeric; v_monto numeric; v_txt text;
  v_cab_pc text := '{"x-flotapp-agente": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"';
  v_cab_cel text := '{"x-flotapp-agente": "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"';
begin
  if exists (select 1 from public.organizaciones where id::text like 'de000000-%') then
    raise exception 'Las empresas de muestra ya están cargadas. Para volver a cargarlas, primero ejecutá borrar_empresas_demo.sql.';
  end if;
  if v_clave like ':%' or length(v_clave) < 10 then raise exception 'Falta la clave: generá empresas_demo.sql con armar.mjs.'; end if;
  perform setseed(0.241026);
  h0 := hoy - 170;
  d0 := hoy - 20;

  -- ───────────── Catálogos de trabajo ─────────────
  drop table if exists demo_empresa, demo_cuenta, demo_trabajo, demo_ot;
  create temp table demo_empresa (
    n int primary key, nombre text, tipo public.tipo_organizacion, slug text, plan text, prov text,
    tractores int, chasis int, semis int, acoplados int, bajas int, km_min int, km_max int, gasoil numeric,
    destinos text[], con_taller text, con_recap boolean, peligrosas boolean, liviano boolean
  );
  insert into demo_empresa values
    (9, 'Taller Diesel Rosario', 'taller', 'diesel', null, 'Santa Fe', 0, 0, 0, 0, 0, 0, 0, 0, null, null, false, false, false),
    (10, 'Recapados Centro', 'recapadora', 'recapados', null, 'Córdoba', 0, 0, 0, 0, 0, 0, 0, 0, null, null, false, false, false),
    (1, 'Transportes Cordillera', 'flota', 'cordillera', 'flota', 'Mendoza', 9, 0, 5, 0, 0, 420, 680, 1715,
      array['Buenos Aires','Rosario','Córdoba','San Juan','San Luis','Paso Cristo Redentor','Neuquén'], null, true, false, false),
    (2, 'Logística Paraná Sur', 'flota', 'paranasur', 'empresa', 'Santa Fe', 14, 0, 10, 0, 1, 250, 560, 1690,
      array['Puerto San Lorenzo','Buenos Aires','Córdoba','Pergamino','Venado Tuerto','Santa Fe','Zárate'], 'activo', true, false, false),
    (3, 'Expreso Pampa', 'flota', 'pampa', 'flota', 'Buenos Aires', 5, 0, 3, 0, 0, 380, 620, 1705,
      array['Buenos Aires','Neuquén','Mar del Plata','Santa Rosa','Viedma','Tres Arroyos'], 'activo', false, false, false),
    (4, 'Cargas del Litoral', 'flota', 'litoral', 'flota', 'Santa Fe', 3, 6, 0, 2, 0, 180, 420, 1680,
      array['Rosario','Paraná','Rafaela','Reconquista','Esperanza','Buenos Aires'], null, false, true, false),
    (5, 'Fletes del Norte', 'flota', 'norte', 'inicial', 'Tucumán', 2, 3, 0, 0, 0, 220, 480, 1740,
      array['Salta','Santiago del Estero','Catamarca','Jujuy','Córdoba'], null, false, false, false),
    (6, 'Distribuidora Atlántica', 'flota', 'atlantica', 'flota', 'Buenos Aires', 0, 7, 0, 0, 0, 90, 210, 1700,
      array['Miramar','Balcarce','Necochea','Villa Gesell','Pinamar','Tandil'], null, false, false, true),
    (7, 'Transportes Mesopotamia', 'flota', 'mesopotamia', 'empresa', 'Entre Ríos', 10, 0, 8, 0, 0, 300, 600, 1695,
      array['Buenos Aires','Rosario','Concordia','Gualeguaychú','Posadas','Corrientes','Santa Fe'], 'activo', false, false, false),
    (8, 'Agrofletes San Jorge', 'flota', 'sanjorge', 'flota', 'Córdoba', 2, 4, 0, 3, 0, 200, 450, 1710,
      array['Puerto San Lorenzo','Río Cuarto','Villa María','Marcos Juárez','San Francisco','Rosario'], 'pendiente', true, false, false);

  -- Cuentas para entrar (todas con la misma clave). El chofer con cuenta es el primer chofer de su flota.
  create temp table demo_cuenta (n int primary key, org int, email text, nombre text, rol public.rol_miembro);
  insert into demo_cuenta values
    (1, 1, 'admin.cordillera@flotapp.test', 'Laura Bianchi', 'admin'),
    (2, 1, 'jefe.cordillera@flotapp.test', 'Ricardo Funes', 'jefe_taller'),
    (3, 1, 'mecanico.cordillera@flotapp.test', 'Raúl Benítez', 'mecanico'),
    (4, 1, 'mecanico2.cordillera@flotapp.test', 'Walter Ibáñez', 'mecanico'),
    (5, 1, 'chofer.cordillera@flotapp.test', null, 'chofer'),
    (6, 2, 'admin.paranasur@flotapp.test', 'Martín Ferraro', 'admin'),
    (7, 2, 'jefe.paranasur@flotapp.test', 'Gustavo Rinaldi', 'jefe_taller'),
    (8, 2, 'mecanico.paranasur@flotapp.test', 'Hugo Peralta', 'mecanico'),
    (9, 2, 'mecanico2.paranasur@flotapp.test', 'Darío Quiroga', 'mecanico'),
    (10, 2, 'mecanico3.paranasur@flotapp.test', 'Leandro Vera', 'mecanico'),
    (11, 2, 'chofer.paranasur@flotapp.test', null, 'chofer'),
    (12, 2, 'consulta.paranasur@flotapp.test', 'Silvina Rossi', 'lectura'),
    (13, 3, 'admin.pampa@flotapp.test', 'Andrea Costa', 'admin'),
    (14, 3, 'mecanico.pampa@flotapp.test', 'Néstor Aguilar', 'mecanico'),
    (15, 3, 'chofer.pampa@flotapp.test', null, 'chofer'),
    (16, 4, 'admin.litoral@flotapp.test', 'Fernando Zapata', 'admin'),
    (17, 4, 'mecanico.litoral@flotapp.test', 'Omar Villalba', 'mecanico'),
    (18, 4, 'chofer.litoral@flotapp.test', null, 'chofer'),
    (19, 5, 'admin.norte@flotapp.test', 'Cecilia Paz', 'admin'),
    (20, 5, 'mecanico.norte@flotapp.test', 'Ramón Ledesma', 'mecanico'),
    (21, 5, 'chofer.norte@flotapp.test', null, 'chofer'),
    (22, 6, 'admin.atlantica@flotapp.test', 'Pablo Mancini', 'admin'),
    (23, 6, 'mecanico.atlantica@flotapp.test', 'Sergio Duarte', 'mecanico'),
    (24, 6, 'chofer.atlantica@flotapp.test', null, 'chofer'),
    (25, 7, 'admin.mesopotamia@flotapp.test', 'Marina Galeano', 'admin'),
    (26, 7, 'jefe.mesopotamia@flotapp.test', 'Claudio Montes', 'jefe_taller'),
    (27, 7, 'mecanico.mesopotamia@flotapp.test', 'Rubén Ojeda', 'mecanico'),
    (28, 7, 'mecanico2.mesopotamia@flotapp.test', 'Matías Coronel', 'mecanico'),
    (29, 7, 'chofer.mesopotamia@flotapp.test', null, 'chofer'),
    (30, 8, 'admin.sanjorge@flotapp.test', 'Diego Bustos', 'admin'),
    (31, 8, 'mecanico.sanjorge@flotapp.test', 'Ezequiel Toledo', 'mecanico'),
    (32, 8, 'chofer.sanjorge@flotapp.test', null, 'chofer'),
    (33, 9, 'admin.diesel@flotapp.test', 'Jorge Mansilla', 'admin'),
    (34, 9, 'operario.diesel@flotapp.test', 'Cristian Sosa', 'operario'),
    (35, 10, 'admin.recapados@flotapp.test', 'Mónica Ferreyra', 'admin');

  -- Qué se arregla en cada sistema, con rangos de repuestos y mano de obra (pesos de hoy).
  create temp table demo_trabajo (sistema text, falla text, trabajo text, rep_min numeric, rep_max numeric, mo_min numeric, mo_max numeric);
  insert into demo_trabajo values
    ('niveles', 'Falta refrigerante, hubo que completar', 'Cambio de manguera de refrigerante y completado de nivel', 45000, 120000, 40000, 80000),
    ('niveles', 'Nivel de aceite bajo antes de salir', 'Revisión de consumo de aceite y completado', 60000, 140000, 30000, 60000),
    ('perdidas', 'Pérdida de aceite debajo del motor', 'Cambio de junta de cárter', 90000, 210000, 110000, 180000),
    ('perdidas', 'Gotea gasoil cerca del tanque', 'Cambio de abrazaderas y manguera de combustible', 40000, 110000, 50000, 90000),
    ('visibilidad', 'Espejo derecho flojo', 'Ajuste y cambio de soporte de espejo', 60000, 150000, 20000, 40000),
    ('visibilidad', 'El limpiaparabrisas no barre bien', 'Cambio de escobillas y motor de limpiaparabrisas', 70000, 180000, 30000, 60000),
    ('seguridad', 'Matafuego vencido', 'Recarga de matafuego', 35000, 70000, 0, 0),
    ('seguridad', 'Falta una baliza triangular', 'Reposición de balizas', 25000, 45000, 0, 0),
    ('documentacion', 'Falta la cédula a bordo', 'Copia de documentación para la cabina', 5000, 15000, 0, 0),
    ('tacografo', 'El tacógrafo no marca la velocidad', 'Calibración de tacógrafo', 0, 40000, 60000, 110000),
    ('frenos', 'Pérdida de aire en el circuito de frenos', 'Cambio de válvula y cañería del circuito de aire', 180000, 420000, 90000, 160000),
    ('frenos', 'El freno de mano no traba', 'Cambio de cintas y regulación de frenos', 380000, 720000, 150000, 260000),
    ('direccion', 'Juego excesivo en el volante', 'Cambio de extremos de dirección', 260000, 520000, 120000, 200000),
    ('direccion', 'Elástico delantero quebrado', 'Cambio de elástico delantero', 420000, 690000, 120000, 190000),
    ('neumaticos', 'Cubierta delantera con corte lateral', 'Cambio de cubierta dañada y balanceo', 0, 25000, 40000, 70000),
    ('neumaticos', 'Pinchadura en tracción derecha', 'Reparación de pinchadura y cambio de válvula', 8000, 25000, 15000, 35000),
    ('luces', 'Luz de giro trasera izquierda quemada', 'Cambio de lámparas y reparación de cableado trasero', 35000, 140000, 40000, 90000),
    ('luces', 'No funciona la luz de freno', 'Cambio de interruptor de luz de freno', 30000, 90000, 30000, 60000),
    ('motor', 'Pierde potencia en las subidas', 'Cambio de filtros de combustible y limpieza de inyectores', 280000, 520000, 140000, 240000),
    ('motor', 'La temperatura sube en ruta', 'Cambio de bomba de agua y termostato', 260000, 480000, 140000, 220000),
    ('electricidad', 'La batería no carga, testigo encendido', 'Cambio de alternador', 380000, 620000, 80000, 140000),
    ('carroceria', 'Lona del semi rota', 'Reparación de lona y cintas de sujeción', 90000, 240000, 60000, 120000),
    ('carroceria', 'La puerta de la caja no cierra bien', 'Cambio de bisagras y cierre de puerta', 70000, 160000, 50000, 90000);

  create temp table demo_ot (
    org uuid, unidad uuid, tipo public.tipo_orden, descripcion text, nota text, estado public.estado_orden, ingreso date, egreso date,
    km int, repuestos numeric, mano_obra numeric, deja boolean, proveedor uuid, taller_nombre text, mecanico uuid, cuando timestamptz,
    fallas uuid[], tarea uuid
  );

  -- Ítems del chequeo, todos bien, según el tipo de unidad.
  select jsonb_object_agg(clave, jsonb_build_object('estado', 'ok')) into v_ok_tractor from public.items_chequeo where solo_tipos is null or 'tractor' = any (solo_tipos);
  select jsonb_object_agg(clave, jsonb_build_object('estado', 'ok')) into v_ok_chasis from public.items_chequeo where solo_tipos is null or 'chasis' = any (solo_tipos);

  -- ───────────── Cuentas ─────────────
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', pg_temp.cuenta(c.n), 'authenticated', 'authenticated', c.email,
    extensions.crypt(v_clave, extensions.gen_salt('bf')), now() - interval '175 days', '{"provider": "email", "providers": ["email"]}', '{}',
    now() - interval '175 days', now(), case when c.n % 4 <> 0 then now() - make_interval(hours => (c.n * 7) % 60) end, '', '', '', ''
  from demo_cuenta c;
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select pg_temp.cuenta(c.n)::text, pg_temp.cuenta(c.n), jsonb_build_object('sub', pg_temp.cuenta(c.n)::text, 'email', c.email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now() - interval '175 days', now()
  from demo_cuenta c;

  -- ───────────── Taller y recapadora ─────────────
  v_taller := pg_temp.org(9);
  v_recap := pg_temp.org(10);
  for e in select * from demo_empresa where tipo <> 'flota' order by n loop
    insert into public.organizaciones (id, nombre, tipo, creado_en) values (pg_temp.org(e.n), e.nombre, e.tipo, now() - interval '180 days');
    for r in select * from demo_cuenta where org = e.n order by n loop
      perform set_config('request.jwt.claim.sub', pg_temp.cuenta((select min(n) from demo_cuenta where org = e.n))::text, true);
      insert into public.miembros (organizacion_id, user_id, rol, nombre, creado_en) values (pg_temp.org(e.n), pg_temp.cuenta(r.n), r.rol, r.nombre, now() - interval '178 days');
    end loop;
  end loop;

  -- ───────────── Flotas ─────────────
  for e in select * from demo_empresa where tipo = 'flota' order by n loop
    v_org := pg_temp.org(e.n);
    v_admin := pg_temp.cuenta((select min(n) from demo_cuenta where org = e.n and rol = 'admin'));
    v_jefe := (select pg_temp.cuenta(n) from demo_cuenta where org = e.n and rol = 'jefe_taller');
    v_mecs := array(select pg_temp.cuenta(n) from demo_cuenta where org = e.n and rol in ('mecanico', 'jefe_taller') order by n);
    v_login_chofer := (select pg_temp.cuenta(n) from demo_cuenta where org = e.n and rol = 'chofer');
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    perform set_config('request.headers', v_cab_pc || ', "x-flotapp-ip": "190.18.44.' || (10 + e.n) || '"}', true);

    insert into public.organizaciones (id, nombre, tipo, creado_en) values (v_org, e.nombre, 'flota', now() - interval '175 days');
    -- El trigger le crea 14 días de prueba; quedan activas, pagas mes a mes, sin vencimiento.
    update public.suscripciones set plan = e.plan, estado = 'activa', periodo = 'mensual', proveedor = 'manual',
      precio = (select precio_mensual from public.planes where clave = e.plan), prueba_hasta = now() - interval '161 days',
      periodo_hasta = null, creada_en = now() - interval '175 days'
    where organizacion_id = v_org;
    insert into public.configuracion (organizacion_id) values (v_org);
    v_tipos := array[]::uuid[];
    for r in select * from (values
        (1, 'RTO (Revisión Técnica Obligatoria)', 'unidad', 'Ley 24.449, art. 34. Verificá el plazo vigente para tu jurisdicción.'),
        (2, 'Seguro de responsabilidad civil', 'unidad', null),
        (3, 'Control del tacógrafo', 'unidad', 'Ley 24.449, art. 53 inc. g.'),
        (4, 'Licencia de conducir profesional', 'chofer', null),
        (5, 'Curso de cargas peligrosas', 'chofer', null)) as x(orden, nombre, aplica, nota) order by orden loop
      insert into public.tipos_documento (organizacion_id, nombre, aplica, vigencia_meses, aviso_dias, nota)
      values (v_org, r.nombre, r.aplica::public.aplica_documento, 12, 30, r.nota) returning id into v_id;
      v_tipos := v_tipos || v_id;
    end loop;
    if e.con_taller is not null then
      insert into public.vinculos_proveedor (flota_id, proveedor_id, estado, creado_en) values (v_org, v_taller, e.con_taller::public.estado_vinculo, now() - interval '150 days');
    end if;
    if e.con_recap then
      insert into public.vinculos_proveedor (flota_id, proveedor_id, estado, creado_en) values (v_org, v_recap, 'activo', now() - interval '150 days');
    end if;

    -- Equipo (sin el chofer con cuenta, que se suma con su ficha).
    for r in select * from demo_cuenta where org = e.n and rol <> 'chofer' order by n loop
      insert into public.miembros (organizacion_id, user_id, rol, nombre, creado_en)
      values (v_org, pg_temp.cuenta(r.n), r.rol, r.nombre, now() - make_interval(days => 172 - r.n % 5));
    end loop;

    -- Choferes: uno por unidad de tracción y uno de reserva.
    n_tr := e.tractores + e.chasis;
    v_choferes := array[]::uuid[];
    for i in 1 .. n_tr + 1 loop
      insert into public.choferes (organizacion_id, nombre, telefono, creado_en)
      values (v_org, nombres[1 + (e.n * 13 + i * 7) % 40] || ' ' || apellidos[1 + (e.n * 17 + i * 11) % 40],
        (array['261','341','291','342','381','223','343','351'])[e.n] || ' 555-' || lpad((1000 + e.n * 100 + i)::text, 4, '0'), now() - interval '170 days')
      returning id into v_id;
      v_choferes := v_choferes || v_id;
    end loop;
    v_reserva := v_choferes[n_tr + 1];
    insert into public.miembros (organizacion_id, user_id, rol, chofer_id, nombre, creado_en)
    values (v_org, v_login_chofer, 'chofer', v_choferes[1], (select nombre from public.choferes where id = v_choferes[1]), now() - interval '168 days');

    -- Unidades: primero las de tracción (con su chofer), después semirremolques, acoplados y las dadas de baja.
    for i in 1 .. n_tr + e.semis + e.acoplados + e.bajas loop
      if i <= e.tractores then v_mm := string_to_array(m_tractor[1 + (i * 3 + e.n) % array_length(m_tractor, 1)], '|'); v_txt := 'tractor';
      elsif i <= n_tr then v_mm := string_to_array((case when e.liviano then m_liviano else m_chasis end)[1 + (i + e.n) % 4], '|'); v_txt := 'chasis';
      elsif i <= n_tr + e.semis then v_mm := string_to_array(m_semi[1 + (i + e.n) % array_length(m_semi, 1)], '|'); v_txt := 'semirremolque';
      elsif i <= n_tr + e.semis + e.acoplados then v_mm := string_to_array(m_acoplado[1 + (i + e.n) % array_length(m_acoplado, 1)], '|'); v_txt := 'acoplado';
      else v_mm := string_to_array(m_tractor[2], '|'); v_txt := 'tractor';
      end if;
      v_anio := case when i > n_tr + e.semis + e.acoplados then 2009 else pg_temp.ent(2011, 2025) end;
      loop
        v_dom := pg_temp.patente(v_anio);
        exit when not exists (select 1 from public.unidades where organizacion_id = v_org and dominio = v_dom);
      end loop;
      v_km := case v_txt
        when 'tractor' then (2026 - v_anio) * pg_temp.ent(85000, 115000) + pg_temp.ent(15000, 40000)
        when 'chasis' then (2026 - v_anio) * (case when e.liviano then pg_temp.ent(38000, 52000) else pg_temp.ent(58000, 78000) end) + pg_temp.ent(8000, 25000)
      end;
      insert into public.unidades (organizacion_id, dominio, tipo, marca, modelo, anio, km, jurisdiccion, estado, chofer_id, cargas_peligrosas, creado_en)
      values (v_org, v_dom, v_txt::public.tipo_unidad, v_mm[1], v_mm[2], v_anio, v_km,
        case when e.liviano then e.prov else 'Nacional' end,
        case when i > n_tr + e.semis + e.acoplados then 'baja' else 'operativa' end::public.estado_unidad,
        case when i <= n_tr then v_choferes[i] end, e.peligrosas and i in (2, 3), now() - interval '172 days')
      returning id into v_id;
      if v_km is not null then
        insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en)
        values (v_org, v_id, v_km, h0 - 2, 'alta', v_admin, pg_temp.momento(h0 - 2, 11));
      end if;
    end loop;

    -- Plan de mantenimiento de cada unidad (se muestra cuando exista la pantalla; los services lo actualizan).
    for u in select * from public.unidades where organizacion_id = v_org and estado <> 'baja' loop
      if u.tipo in ('tractor', 'chasis') then
        insert into public.tareas_plan (organizacion_id, unidad_id, tarea, cada_km, cada_dias, ultimo_km, ultima_fecha) values
          (v_org, u.id, 'Service de motor: aceite, filtros y engrase', 25000, null, u.km - pg_temp.ent(2000, 20000), h0 - pg_temp.ent(5, 40)),
          (v_org, u.id, 'Revisión de frenos', 50000, 180, u.km - pg_temp.ent(5000, 45000), h0 - pg_temp.ent(10, 90)),
          (v_org, u.id, 'Alineación y balanceo', 40000, 180, u.km - pg_temp.ent(5000, 35000), h0 - pg_temp.ent(10, 90));
      else
        insert into public.tareas_plan (organizacion_id, unidad_id, tarea, cada_km, cada_dias, ultimo_km, ultima_fecha) values
          (v_org, u.id, 'Revisión de frenos y rodamientos', null, 90, null, hoy - pg_temp.ent(20, 110)),
          (v_org, u.id, 'Engrase general', null, 30, null, hoy - pg_temp.ent(3, 40));
      end if;
    end loop;

    -- Cubiertas montadas en cada unidad de tracción, más algunas en el depósito.
    v_seq := 0;
    for u in select * from public.unidades where organizacion_id = v_org and tipo in ('tractor', 'chasis') and estado <> 'baja' order by creado_en, dominio loop
      v_medida := case when e.liviano then '215/75 R17.5' when u.tipo = 'tractor' then '295/80 R22.5' else '275/80 R22.5' end;
      for j in 1 .. 6 loop
        v_seq := v_seq + 1;
        v_marca := pg_temp.uno(cubiertas);
        v_precio := pg_temp.plata(pg_temp.entre(780000, 920000) * (case when e.liviano then 0.55 else 1 end), 1000);
        k := case when j <= 2 then 0 else pg_temp.ent(0, 2) end;
        x := h0 - pg_temp.ent(15, 200);
        v_km := greatest(0, u.km - pg_temp.ent(5000, 70000));
        insert into public.neumaticos (organizacion_id, codigo, marca, medida, profundidad, recapados, precio, costo_total, km_total, km_vida,
          estado, unidad_id, posicion, km_montaje, fecha_montaje, fecha_medicion, creado_en)
        values (v_org, upper(left(e.slug, 3)) || '-' || lpad(v_seq::text, 4, '0'), v_marca, v_medida, round(pg_temp.entre(7, 15), 1), k, v_precio,
          v_precio + k * pg_temp.plata(235000 * (case when e.liviano then 0.6 else 1 end), 1000), k * pg_temp.ent(90000, 140000), 0,
          'montado', u.id, posiciones[j], v_km, x, x, pg_temp.momento(x - 1, 10))
        returning id into v_id;
        insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, profundidad, costo, user_id, creado_en)
        values (v_org, v_id, 'alta', x - 1, v_marca || ' ' || v_medida, 16, v_precio, v_admin, pg_temp.momento(x - 1, 10));
        insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, km, user_id, creado_en)
        values (v_org, v_id, 'montaje', x, 'Montado en ' || u.dominio || ' · ' || posiciones[j], u.id, posiciones[j], v_km, v_mecs[1], pg_temp.momento(x, 15));
      end loop;
    end loop;
    for j in 1 .. 3 loop
      v_seq := v_seq + 1;
      v_marca := pg_temp.uno(cubiertas);
      v_medida := case when e.liviano then '215/75 R17.5' when e.tractores > 0 then '295/80 R22.5' else '275/80 R22.5' end;
      v_precio := pg_temp.plata(pg_temp.entre(780000, 920000) * (case when e.liviano then 0.55 else 1 end), 1000);
      x := hoy - pg_temp.ent(25, 60);
      insert into public.neumaticos (organizacion_id, codigo, marca, medida, profundidad, recapados, precio, costo_total, estado, fecha_medicion, creado_en)
      values (v_org, upper(left(e.slug, 3)) || '-' || lpad(v_seq::text, 4, '0'), v_marca, v_medida, case when j = 3 then 14 else 16 end,
        case when j = 3 then 1 else 0 end, v_precio, v_precio + case when j = 3 then 235000 else 0 end, 'deposito', x, pg_temp.momento(x, 10))
      returning id into v_id;
      insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, profundidad, costo, user_id, creado_en)
      values (v_org, v_id, 'alta', x, v_marca || ' ' || v_medida || case when j = 3 then ' · recapada' else '' end, case when j = 3 then 14 else 16 end, v_precio, v_admin, pg_temp.momento(x, 10));
    end loop;

    -- ───────────── Actividad de cada unidad de tracción ─────────────
    -- Cada unidad de tracción se reconoce por el número de su chofer: la 1 es la del chofer con cuenta.
    for u in select * from public.unidades where organizacion_id = v_org and tipo in ('tractor', 'chasis') and estado <> 'baja' order by dominio loop
      v_idx := array_position(v_choferes, u.chofer_id);
      v_km := u.km;
      v_chofer := u.chofer_id;
      v_usr := case when v_chofer = v_choferes[1] then v_login_chofer else pg_temp.fantasma(v_chofer) end;
      v_tasa := case when u.tipo = 'tractor' then pg_temp.entre(0.34, 0.40) when e.liviano then pg_temp.entre(0.19, 0.23) else pg_temp.entre(0.26, 0.31) end;
      v_umbral := case when e.liviano then pg_temp.entre(110, 160) else pg_temp.entre(320, 480) end;
      v_acc := 0;
      v_servicio := (v_km / 25000 + 1) * 25000;
      select id into v_tarea from public.tareas_plan where unidad_id = u.id and cada_km = 25000;
      v_libre := h0;
      v_semana_viajes := 0;
      v_ult_fin := null;
      -- Lo que le pasa a algunas unidades: una rotura que ya se arregló, una que la tiene parada hoy y un trabajo en el taller externo.
      v_crit := case when v_idx = 2 then d0 + pg_temp.ent(3, 9) when v_idx = n_tr and n_tr >= 3 then hoy - 1 end;
      v_crit_abierta := v_idx = n_tr;
      v_externo := case when e.con_taller = 'activo' and v_idx = 3 then hoy - 4 end;
      -- En las flotas 1 a 4 el chofer con cuenta está en viaje ahora; en las demás puede empezar uno.
      v_en_curso_forzado := v_idx = 1 and e.n <= 4;

      -- Historia: kilómetros por día, cargas en el surtidor de la base, peajes y viáticos semanales, services y roturas.
      d := h0;
      while d < d0 loop
        if d >= v_libre and random() < (case extract(isodow from d) when 7 then 0.2 when 6 then 0.6 else 0.9 end) then
          v_dist := pg_temp.ent(e.km_min, e.km_max);
          v_km := v_km + v_dist;
          v_acc := v_acc + v_dist * v_tasa * pg_temp.entre(0.93, 1.07);
          v_semana_viajes := v_semana_viajes + 1;
        end if;
        if v_acc >= v_umbral then
          insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en)
          values (v_org, u.id, v_km, d, 'manual', v_admin, pg_temp.momento(d, 19.5));
          v_litros := round(v_acc, 1);
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, litros, km, descripcion, cargado_por, creado_en)
          values (v_org, 'combustible', round(v_litros * pg_temp.precio(e.gasoil, d, hoy) * pg_temp.entre(0.96, 0.99), 2), d, u.id, v_litros, v_km,
            'Carga en el surtidor de la base', v_admin, pg_temp.momento(d, 19.6));
          v_acc := 0;
          v_umbral := case when e.liviano then pg_temp.entre(110, 160) else pg_temp.entre(320, 480) end;
        end if;
        if extract(isodow from d) = 5 and v_semana_viajes > 0 then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, descripcion, cargado_por, creado_en)
          values (v_org, 'peaje', pg_temp.plata(v_semana_viajes * pg_temp.entre(6000, 20000) * pg_temp.precio(1, d, hoy), 100), d, u.id, v_chofer,
            'Peajes de la semana', v_admin, pg_temp.momento(d, 18));
          if e.km_max > 300 then
            insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, descripcion, cargado_por, creado_en)
            values (v_org, 'viatico', pg_temp.plata(v_semana_viajes * pg_temp.entre(14000, 26000) * pg_temp.precio(1, d, hoy), 500), d, u.id, v_chofer,
              'Viáticos de la semana', v_admin, pg_temp.momento(d, 18.2));
          end if;
          v_semana_viajes := 0;
        end if;
        if v_km >= v_servicio then
          insert into demo_ot values (v_org, u.id, 'preventivo', 'Service de motor: aceite, filtros y engrase',
            'Aceite 15W40, filtros de aceite, gasoil y aire. Engrase general.', 'cerrada', d, d, v_km,
            pg_temp.plata(pg_temp.entre(520000, 780000) * (case when e.liviano then 0.6 else 1 end) * pg_temp.precio(1, d, hoy), 1000),
            pg_temp.plata(pg_temp.entre(140000, 220000) * pg_temp.precio(1, d, hoy), 1000), false, null, null,
            v_mecs[1 + (v_idx + extract(doy from d)::int) % array_length(v_mecs, 1)], pg_temp.momento(d, 16), '{}', v_tarea);
          v_servicio := v_servicio + 25000;
        end if;
        if d >= v_libre and random() < 0.011 then
          select * into t from demo_trabajo where u.tipo = 'tractor' or sistema <> 'carroceria' order by random() limit 1;
          v_dur := pg_temp.ent(0, 2);
          insert into demo_ot values (v_org, u.id, 'correctivo', t.trabajo, null, 'cerrada', d, d + v_dur, v_km,
            pg_temp.plata(pg_temp.entre(t.rep_min, t.rep_max) * pg_temp.precio(1, d, hoy), 1000),
            pg_temp.plata(pg_temp.entre(t.mo_min, t.mo_max) * pg_temp.precio(1, d, hoy), 1000), v_dur > 0, null, null,
            v_mecs[1 + (v_idx + extract(doy from d)::int) % array_length(v_mecs, 1)], pg_temp.momento(d, 9), '{}', null);
          v_libre := d + v_dur + 1;
        end if;
        d := d + 1;
      end loop;

      -- Últimos 20 días: un viaje por día con su chequeo, cargas en ruta, peajes, viáticos y fallas.
      d := d0;
      while d < hoy loop
        if d < v_libre then d := d + 1; continue; end if;
        v_ch := v_chofer;
        v_us := v_usr;
        if v_idx = 4 and d between hoy - 12 and hoy - 7 then
          v_ch := v_reserva;
          v_us := pg_temp.fantasma(v_reserva);
        end if;
        v_destino := pg_temp.uno(e.destinos);

        -- Rotura en el chequeo: no sale, la unidad va al taller.
        if v_crit = d or v_externo = d then
          v_ini := pg_temp.momento(d, pg_temp.entre(5, 7.5));
          if v_externo = d then
            v_sis := 'motor';
            insert into public.fallas (organizacion_id, unidad_id, sistema, descripcion, gravedad, estado, origen, chofer_id, reportada_por, creada_en)
            values (v_org, u.id, 'motor', 'Humo blanco y pérdida de potencia', 'critica', 'abierta', 'taller', v_ch, v_mecs[1], v_ini)
            returning id into v_falla;
            insert into demo_ot values (v_org, u.id, 'correctivo', 'Rectificación de tapa de cilindros y cambio de junta', null, 'en_proveedor', d, null, v_km,
              0, 0, true, v_taller, null, v_mecs[1], v_ini + interval '2 hours', array[v_falla], null);
            v_libre := hoy + 1;
          else
            v_sis := pg_temp.uno(criticos);
            select * into t from demo_trabajo where sistema = v_sis order by random() limit 1;
            v_items := jsonb_set(case when u.tipo = 'tractor' then v_ok_tractor else v_ok_chasis end, array[v_sis],
              jsonb_build_object('estado', 'problema', 'nota', t.falla));
            insert into public.chequeos (organizacion_id, unidad_id, chofer_id, user_id, fecha, km, combustible, items, aprobado)
            values (v_org, u.id, v_ch, v_us, v_ini, v_km, pg_temp.ent(40, 90), v_items, false) returning id into v_chequeo;
            insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en) values (v_org, u.id, v_km, d, 'chequeo', v_us, v_ini);
            insert into public.fallas (organizacion_id, unidad_id, sistema, descripcion, gravedad, estado, origen, chequeo_id, chofer_id, reportada_por, creada_en)
            values (v_org, u.id, v_sis, t.falla, 'critica', 'abierta', 'chequeo', v_chequeo, v_ch, v_us, v_ini) returning id into v_falla;
            v_dur := pg_temp.ent(1, 3);
            insert into demo_ot values (v_org, u.id, 'correctivo', t.trabajo, case when v_crit_abierta then null else 'Probado en ruta, quedó bien.' end,
              case when v_crit_abierta then 'abierta' else 'cerrada' end::public.estado_orden, d, case when v_crit_abierta then null else d + v_dur end, v_km,
              case when v_crit_abierta then 0 else pg_temp.plata(pg_temp.entre(t.rep_min, t.rep_max), 1000) end,
              case when v_crit_abierta then 0 else pg_temp.plata(pg_temp.entre(t.mo_min, t.mo_max), 1000) end,
              true, null, null, v_mecs[1 + v_idx % array_length(v_mecs, 1)], v_ini + interval '1 hour', array[v_falla], null);
            v_libre := case when v_crit_abierta then hoy + 1 else d + v_dur + 1 end;
          end if;
          d := d + 1;
          continue;
        end if;

        if random() >= (case extract(isodow from d) when 7 then 0.2 when 6 then 0.6 else 0.9 end) then d := d + 1; continue; end if;

        v_dist := pg_temp.ent(e.km_min, e.km_max);
        v_ini := pg_temp.momento(d, pg_temp.entre(4.5, 8.5));
        v_fin := v_ini + make_interval(secs => ((v_dist / 65.0 + pg_temp.entre(0.5, 2)) * 3600)::double precision);
        v_sis := case when random() < 0.06 then pg_temp.uno(leves || 'tacografo'::text) end;
        v_items := case when u.tipo = 'tractor' then v_ok_tractor else v_ok_chasis end;
        if v_sis is not null then
          select * into t from demo_trabajo where sistema = v_sis order by random() limit 1;
          v_items := jsonb_set(v_items, array[v_sis], jsonb_build_object('estado', 'problema', 'nota', t.falla));
        end if;
        insert into public.chequeos (organizacion_id, unidad_id, chofer_id, user_id, fecha, km, combustible, items, aprobado)
        values (v_org, u.id, v_ch, v_us, v_ini - interval '12 minutes', v_km, pg_temp.ent(35, 95), v_items, true) returning id into v_chequeo;
        insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en) values (v_org, u.id, v_km, d, 'chequeo', v_us, v_ini);
        if v_sis is not null then
          insert into public.fallas (organizacion_id, unidad_id, sistema, descripcion, gravedad, estado, origen, chequeo_id, chofer_id, reportada_por, creada_en, resuelta_en)
          values (v_org, u.id, v_sis, t.falla, 'moderada', case when d <= hoy - 3 and random() < 0.15 then 'descartada' else 'abierta' end::public.estado_falla,
            'chequeo', v_chequeo, v_ch, v_us, v_ini, null)
          returning id into v_falla;
          update public.fallas set resuelta_en = v_ini + interval '1 day' where id = v_falla and estado = 'descartada';
          if d <= hoy - 3 and (select estado from public.fallas where id = v_falla) = 'abierta' then
            x := d + pg_temp.ent(1, 2);
            insert into demo_ot values (v_org, u.id, 'correctivo', t.trabajo, null, 'cerrada', x, x, v_km,
              pg_temp.plata(pg_temp.entre(t.rep_min, t.rep_max), 1000), pg_temp.plata(pg_temp.entre(t.mo_min, t.mo_max), 1000), false, null, null,
              v_mecs[1 + (v_idx + extract(doy from x)::int) % array_length(v_mecs, 1)], pg_temp.momento(x, 17.5), array[v_falla], null);
          end if;
        end if;

        insert into public.viajes (organizacion_id, unidad_id, chofer_id, user_id, estado, inicio, fin, km_inicio, km_fin, combustible_inicio, combustible_fin, destino, chequeo_id)
        values (v_org, u.id, v_ch, v_us, 'terminado', v_ini, v_fin, v_km, v_km + v_dist, pg_temp.ent(45, 95), pg_temp.ent(15, 45), v_destino, v_chequeo)
        returning id into v_viaje;
        v_km := v_km + v_dist;
        v_ult_fin := v_fin;
        x := pg_temp.dia(v_fin);
        insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en) values (v_org, u.id, v_km, x, 'viaje', v_us, v_fin);

        v_acc := v_acc + v_dist * v_tasa * pg_temp.entre(0.93, 1.07);
        if v_acc >= v_umbral then
          v_litros := round(v_acc, 1);
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, viaje_id, litros, km, descripcion, cargado_por, creado_en)
          values (v_org, 'combustible', round(v_litros * pg_temp.precio(e.gasoil, x, hoy) * pg_temp.entre(0.99, 1.04), 2), x, u.id, v_ch, v_viaje, v_litros, v_km,
            'Carga en ' || pg_temp.uno(estaciones) || ' · ' || v_destino, v_us, v_fin - interval '40 minutes');
          v_acc := 0;
          v_umbral := case when e.liviano then pg_temp.entre(110, 160) else pg_temp.entre(320, 480) end;
        end if;
        if random() < 0.65 then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, viaje_id, descripcion, cargado_por, creado_en)
          values (v_org, 'peaje', pg_temp.plata(pg_temp.ent(1, 4) * pg_temp.entre(4500, 12000), 100), x, u.id, v_ch, v_viaje, 'Peajes · ' || v_destino, v_us, v_fin - interval '20 minutes');
        end if;
        if v_dist > 350 and random() < 0.55 then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, viaje_id, descripcion, cargado_por, creado_en)
          values (v_org, 'viatico', pg_temp.plata(pg_temp.entre(15000, 32000), 500), x, u.id, v_ch, v_viaje, 'Comidas en ruta', v_us, v_fin - interval '10 minutes');
        end if;
        -- Falla que avisa el chofer durante el viaje.
        if random() < 0.035 then
          v_sis := pg_temp.uno(en_ruta);
          select * into t from demo_trabajo where sistema = v_sis order by random() limit 1;
          insert into public.fallas (organizacion_id, unidad_id, sistema, descripcion, gravedad, estado, origen, viaje_id, chofer_id, reportada_por, creada_en)
          values (v_org, u.id, v_sis, t.falla, 'moderada', 'abierta', 'viaje', v_viaje, v_ch, v_us, v_ini + (v_fin - v_ini) / 2) returning id into v_falla;
          if d <= hoy - 3 then
            x := d + pg_temp.ent(1, 2);
            insert into demo_ot values (v_org, u.id, 'correctivo', t.trabajo, null, 'cerrada', x, x, v_km,
              pg_temp.plata(pg_temp.entre(t.rep_min, t.rep_max), 1000), pg_temp.plata(pg_temp.entre(t.mo_min, t.mo_max), 1000), false, null, null,
              v_mecs[1 + (v_idx + extract(doy from x)::int) % array_length(v_mecs, 1)], pg_temp.momento(x, 18), array[v_falla], null);
          end if;
        end if;
        if v_km >= v_servicio then
          x := least(d + 1, hoy - 1);
          insert into demo_ot values (v_org, u.id, 'preventivo', 'Service de motor: aceite, filtros y engrase',
            'Aceite 15W40, filtros de aceite, gasoil y aire. Engrase general.', 'cerrada', x, x, v_km,
            pg_temp.plata(pg_temp.entre(520000, 780000) * (case when e.liviano then 0.6 else 1 end), 1000), pg_temp.plata(pg_temp.entre(140000, 220000), 1000),
            false, null, null, v_mecs[1 + v_idx % array_length(v_mecs, 1)], pg_temp.momento(x, 20.5), '{}', v_tarea);
          v_servicio := v_servicio + 25000;
        end if;
        d := d + 1;
      end loop;

      -- Hoy: algunas unidades están en viaje (si se carga de madrugada, salen después de terminar el de ayer).
      v_ini := greatest(least(pg_temp.momento(hoy, pg_temp.entre(5, 8)), now() - make_interval(mins => pg_temp.ent(60, 300))),
        coalesce(v_ult_fin, now() - interval '1 day') + interval '1 hour');
      if d >= v_libre and v_ini < now() - interval '10 minutes' and (v_en_curso_forzado or (v_idx > 1 and random() < 0.55)) then
        v_destino := pg_temp.uno(e.destinos);
        insert into public.chequeos (organizacion_id, unidad_id, chofer_id, user_id, fecha, km, combustible, items, aprobado)
        values (v_org, u.id, v_chofer, v_usr, v_ini - interval '10 minutes', v_km, pg_temp.ent(55, 95),
          case when u.tipo = 'tractor' then v_ok_tractor else v_ok_chasis end, true) returning id into v_chequeo;
        insert into public.lecturas_km (organizacion_id, unidad_id, km, fecha, origen, user_id, creado_en)
        values (v_org, u.id, v_km, pg_temp.dia(v_ini), 'chequeo', v_usr, v_ini);
        insert into public.viajes (organizacion_id, unidad_id, chofer_id, user_id, estado, inicio, km_inicio, combustible_inicio, destino, chequeo_id)
        values (v_org, u.id, v_chofer, v_usr, 'en_curso', v_ini, v_km, pg_temp.ent(55, 95), v_destino, v_chequeo);
      end if;
    end loop;

    -- Semirremolques y acoplados: frenos y luces de vez en cuando.
    for u in select * from public.unidades where organizacion_id = v_org and tipo in ('semirremolque', 'acoplado') and estado <> 'baja' loop
      x := h0 + pg_temp.ent(10, 140);
      insert into demo_ot values (v_org, u.id, 'preventivo', 'Revisión de frenos y rodamientos', 'Se regularon frenos y se engrasaron rodamientos.', 'cerrada', x, x, null,
        pg_temp.plata(pg_temp.entre(90000, 260000) * pg_temp.precio(1, x, hoy), 1000), pg_temp.plata(pg_temp.entre(80000, 140000) * pg_temp.precio(1, x, hoy), 1000),
        false, null, null, v_mecs[1], pg_temp.momento(x, 11), '{}', null);
      update public.tareas_plan set ultima_fecha = x where unidad_id = u.id and tarea = 'Revisión de frenos y rodamientos' and ultima_fecha < x;
      if random() < 0.5 then
        x := d0 + pg_temp.ent(0, 18);
        insert into demo_ot values (v_org, u.id, 'correctivo', 'Cambio de lámparas y reparación de cableado del semi', null, 'cerrada', x, x, null,
          pg_temp.plata(pg_temp.entre(35000, 140000), 1000), pg_temp.plata(pg_temp.entre(40000, 90000), 1000), false, null,
          case when random() < 0.5 then 'Electricidad del Automotor Gómez' end, v_mecs[1], pg_temp.momento(x, 16), '{}', null);
      end if;
    end loop;

    -- ───────────── Cambios de cubiertas ─────────────
    -- Unidades 1 y 3 (últimos días) y 2 y 5 (meses atrás): eje delantero nuevo; las usadas van a recapar o a la baja.
    for u in select * from public.unidades where organizacion_id = v_org and tipo in ('tractor', 'chasis') and estado <> 'baja' order by dominio loop
      v_idx := array_position(v_choferes, u.chofer_id);
      x := case v_idx when 1 then d0 + 4 when 3 then hoy - 2 when 2 then h0 + 45 when 5 then h0 + 110 end;
      continue when x is null;
      v_km := coalesce((select max(km) from public.lecturas_km where unidad_id = u.id and fecha <= x), u.km);
      v_medida := (select medida from public.neumaticos where unidad_id = u.id limit 1);
      v_marca := pg_temp.uno(cubiertas);
      v_precio := pg_temp.plata(pg_temp.entre(780000, 920000) * (case when e.liviano then 0.55 else 1 end) * pg_temp.precio(1, x, hoy), 1000);
      v_txt := '';
      for t in select * from public.neumaticos where unidad_id = u.id and posicion in ('Delantero izq', 'Delantero der') and estado = 'montado' order by posicion loop
        -- Sale la usada.
        k := greatest(0, v_km - coalesce(t.km_montaje, v_km));
        if e.con_recap then
          update public.neumaticos set estado = 'recapado', unidad_id = null, posicion = null, km_montaje = null, km_total = km_total + k, km_vida = km_vida + k,
            profundidad = round(pg_temp.entre(2.8, 3.6), 1), proveedor_actual_id = v_recap where id = t.id;
          insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, km, profundidad, proveedor_id, user_id, creado_en)
          values (v_org, t.id, 'envio', x, 'Desde ' || u.dominio || ' ' || t.posicion || ' · Recapados Centro · Desgaste · ' || k || ' km en este montaje',
            u.id, t.posicion, v_km, 3.2, v_recap, v_mecs[1], pg_temp.momento(x, 10));
          if x < hoy - 12 then
            -- Volvió de la recapadora (o la rechazaron).
            if random() < 0.8 then
              update public.neumaticos set estado = 'deposito', recapados = recapados + 1, km_vida = 0, profundidad = 15, fecha_medicion = x + 10,
                costo_total = costo_total + pg_temp.plata(235000 * pg_temp.precio(1, x, hoy), 1000), proveedor_actual_id = null where id = t.id;
              insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, profundidad, costo, proveedor_id, user_id, creado_en)
              values (v_org, t.id, 'recapado', x + 10, 'Vida ' || (t.recapados + 2) || ' · Recapados Centro', 15, pg_temp.plata(235000 * pg_temp.precio(1, x, hoy), 1000),
                v_recap, pg_temp.cuenta(35), pg_temp.momento(x + 10, 12));
            else
              update public.neumaticos set estado = 'baja', proveedor_actual_id = null where id = t.id;
              insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, proveedor_id, user_id, creado_en)
              values (v_org, t.id, 'rechazo', x + 8, 'No recapable · Carcasa con cortes', v_recap, pg_temp.cuenta(35), pg_temp.momento(x + 8, 12));
            end if;
          end if;
        else
          update public.neumaticos set estado = 'baja', unidad_id = null, posicion = null, km_montaje = null, km_total = km_total + k, km_vida = km_vida + k,
            profundidad = round(pg_temp.entre(2.5, 3.2), 1) where id = t.id;
          insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, km, profundidad, user_id, creado_en)
          values (v_org, t.id, 'baja', x, 'Desde ' || u.dominio || ' ' || t.posicion || ' · Desgaste al límite · ' || k || ' km en este montaje',
            u.id, t.posicion, v_km, 2.9, v_mecs[1], pg_temp.momento(x, 10));
        end if;
        -- Entra una nueva.
        v_seq := v_seq + 1;
        insert into public.neumaticos (organizacion_id, codigo, marca, medida, profundidad, precio, costo_total, estado, unidad_id, posicion, km_montaje, fecha_montaje, fecha_medicion, creado_en)
        values (v_org, upper(left(e.slug, 3)) || '-' || lpad(v_seq::text, 4, '0'), v_marca, v_medida, 16, v_precio, v_precio, 'montado', u.id, t.posicion, v_km, x, x, pg_temp.momento(x, 9))
        returning id into v_id;
        insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, profundidad, costo, user_id, creado_en)
        values (v_org, v_id, 'alta', x, v_marca || ' ' || v_medida, 16, v_precio, v_admin, pg_temp.momento(x, 9));
        insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, km, user_id, creado_en)
        values (v_org, v_id, 'montaje', x, 'Montado en ' || u.dominio || ' · ' || t.posicion, u.id, t.posicion, v_km, v_mecs[1], pg_temp.momento(x, 10.5));
        v_txt := v_txt || case when v_txt = '' then '' else ' y ' end || upper(left(e.slug, 3)) || '-' || lpad(v_seq::text, 4, '0');
      end loop;
      insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, descripcion, cargado_por, creado_en)
      values (v_org, 'neumaticos', v_precio * 2, x, u.id, '2 cubiertas ' || v_marca || ' ' || v_medida, v_admin, pg_temp.momento(x, 9));
      insert into demo_ot values (v_org, u.id, 'preventivo', 'Cambio de cubiertas del eje delantero',
        'Se montaron ' || v_txt || '. Las usadas ' || case when e.con_recap then 'van a recapar.' else 'se dieron de baja.' end, 'cerrada', x, x, v_km,
        0, pg_temp.plata(pg_temp.entre(45000, 70000) * pg_temp.precio(1, x, hoy), 1000), false, null, null, v_mecs[1], pg_temp.momento(x, 11), '{}', null);
    end loop;

    -- Rotación en la unidad 2 y mediciones de la semana pasada en las unidades 1 y 2.
    for u in select * from public.unidades where organizacion_id = v_org and tipo in ('tractor', 'chasis') and estado <> 'baja' order by dominio loop
      v_idx := array_position(v_choferes, u.chofer_id);
      continue when v_idx > 2;
      x := hoy - 7;
      v_km := coalesce((select max(km) from public.lecturas_km where unidad_id = u.id and fecha <= x), u.km);
      if v_idx = 2 then
        for t in select * from public.neumaticos where unidad_id = u.id and posicion in ('Tracción izq ext', 'Tracción der ext') order by posicion loop
          v_txt := case t.posicion when 'Tracción izq ext' then 'Tracción der ext' else 'Tracción izq ext' end;
          k := greatest(0, v_km - coalesce(t.km_montaje, v_km));
          update public.neumaticos set posicion = '~' || id::text where id = t.id;
          insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, km, user_id, creado_en)
          values (v_org, t.id, 'rotacion', x, 'De ' || u.dominio || ' ' || t.posicion || ' a ' || u.dominio || ' ' || v_txt, u.id, v_txt, v_km, v_mecs[1], pg_temp.momento(x, 15));
          update public.neumaticos set km_total = km_total + k, km_vida = km_vida + k, km_montaje = v_km, fecha_montaje = x where id = t.id;
        end loop;
        update public.neumaticos set posicion = case when posicion like '~%' then (select ev.posicion from public.neumatico_eventos ev where ev.neumatico_id = neumaticos.id and ev.tipo = 'rotacion' order by ev.creado_en desc limit 1) else posicion end
        where unidad_id = u.id and posicion like '~%';
      end if;
      for t in select * from public.neumaticos where unidad_id = u.id and estado = 'montado' loop
        p := greatest(3, t.profundidad - round(pg_temp.entre(0.2, 1.0), 1));
        update public.neumaticos set profundidad = p, fecha_medicion = x where id = t.id;
        insert into public.neumatico_eventos (organizacion_id, neumatico_id, tipo, fecha, detalle, unidad_id, posicion, profundidad, user_id, creado_en)
        values (v_org, t.id, 'medicion', x, p || ' mm', u.id, t.posicion, p, v_mecs[1], pg_temp.momento(x, 16));
      end loop;
    end loop;

    -- ───────────── Órdenes de trabajo, numeradas por fecha ─────────────
    for r in select * from demo_ot where org = v_org order by ingreso, cuando loop
      perform set_config('request.jwt.claim.sub', r.mecanico::text, true);
      perform set_config('request.headers', v_cab_cel || ', "x-flotapp-ip": "181.47.12.' || (20 + e.n) || '"}', true);
      insert into public.ordenes (organizacion_id, unidad_id, tipo, descripcion, proveedor_id, taller_nombre, estado, fecha_ingreso, fecha_egreso, km,
        repuestos, mano_obra, nota, tarea_plan_id, deja_fuera_servicio, creado_por, creado_en, cerrada_por)
      values (v_org, r.unidad, r.tipo, r.descripcion, r.proveedor, r.taller_nombre, r.estado, r.ingreso, r.egreso, r.km, r.repuestos, r.mano_obra, r.nota,
        r.tarea, r.deja, r.mecanico, r.cuando, case when r.estado = 'cerrada' then r.mecanico end)
      returning id into v_id;
      update public.auditoria set creado_en = pg_temp.momento(r.egreso, 18) where recurso_id = v_id::text and accion = 'orden.cerrada';
      update public.fallas set orden_id = v_id,
        estado = case when r.estado = 'cerrada' then 'resuelta' else 'en_reparacion' end::public.estado_falla,
        resuelta_en = case when r.estado = 'cerrada' then pg_temp.momento(r.egreso, 18) end
      where id = any (r.fallas);
      if r.tarea is not null then
        update public.tareas_plan set ultimo_km = r.km, ultima_fecha = r.egreso where id = r.tarea and (ultimo_km is null or ultimo_km < r.km);
      end if;
    end loop;
    update public.unidades un set estado = 'taller'
    where un.organizacion_id = v_org and un.estado = 'operativa'
      and exists (select 1 from public.ordenes o where o.unidad_id = un.id and o.estado <> 'cerrada' and o.deja_fuera_servicio);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    perform set_config('request.headers', v_cab_pc || ', "x-flotapp-ip": "190.18.44.' || (10 + e.n) || '"}', true);

    -- ───────────── Gastos fijos de cada mes ─────────────
    for x in select generate_series(date_trunc('month', h0)::date, date_trunc('month', hoy)::date, interval '1 month')::date loop
      for u in select * from public.unidades where organizacion_id = v_org and estado <> 'baja' order by dominio loop
        if x + 4 between h0 and hoy then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, descripcion, cargado_por, creado_en)
          values (v_org, 'seguro', pg_temp.plata((case u.tipo when 'tractor' then 360000 when 'chasis' then (case when e.liviano then 190000 else 260000 end) else 115000 end)
            * pg_temp.entre(0.92, 1.08) * pg_temp.precio(1, x + 4, hoy), 100), x + 4, u.id,
            'Seguro mensual · ' || aseguradoras[1 + e.n % 4], v_admin, pg_temp.momento(x + 4, 10));
        end if;
        if extract(month from x)::int % 2 = 1 and x + 11 between h0 and hoy then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, descripcion, cargado_por, creado_en)
          values (v_org, 'patente', pg_temp.plata((case u.tipo when 'tractor' then 170000 when 'chasis' then 120000 else 75000 end)
            * pg_temp.entre(0.9, 1.1) * pg_temp.precio(1, x + 11, hoy), 100), x + 11, u.id, 'Patente · cuota bimestral · ' || e.prov, v_admin, pg_temp.momento(x + 11, 10.5));
        end if;
        if u.tipo in ('tractor', 'chasis') and x + 2 between h0 and hoy then
          insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, descripcion, cargado_por, creado_en)
          values (v_org, 'otro', pg_temp.plata(26000 * pg_temp.precio(1, x + 2, hoy), 100), x + 2, u.id, 'Rastreo satelital', v_admin, pg_temp.momento(x + 2, 9));
        end if;
        if u.tipo in ('tractor', 'chasis') and random() < 0.5 then
          d := x + pg_temp.ent(5, 25);
          if d between h0 and hoy then
            insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, descripcion, cargado_por, creado_en)
            values (v_org, 'lavado', pg_temp.plata(pg_temp.entre(28000, 45000) * pg_temp.precio(1, d, hoy), 500), d, u.id, u.chofer_id, 'Lavado completo', v_admin, pg_temp.momento(d, 17));
          end if;
        end if;
      end loop;
      if e.tractores >= 10 and x + 1 between h0 and hoy then
        insert into public.gastos (organizacion_id, categoria, monto, fecha, descripcion, cargado_por, creado_en)
        values (v_org, 'otro', pg_temp.plata(680000 * pg_temp.precio(1, x + 1, hoy), 1000), x + 1, 'Alquiler de playa de camiones', v_admin, pg_temp.momento(x + 1, 9.5));
      end if;
      -- Abono del plan de Flotapp de cada mes.
      if x + 1 between h0 and hoy then
        insert into public.pagos (organizacion_id, proveedor, proveedor_pago, estado, monto, fecha, detalle)
        values (v_org, 'manual', 'demo-' || e.n || '-' || to_char(x, 'YYYYMM'), 'aprobado', (select precio_mensual from public.planes where clave = e.plan),
          pg_temp.momento(x + 1, 10), 'Plan ' || (select nombre from public.planes where clave = e.plan) || ' (mensual)');
      end if;
    end loop;
    -- Una multa en algún momento.
    select * into u from public.unidades where organizacion_id = v_org and tipo in ('tractor', 'chasis') and estado <> 'baja' order by random() limit 1;
    x := h0 + pg_temp.ent(20, 150);
    insert into public.gastos (organizacion_id, categoria, monto, fecha, unidad_id, chofer_id, descripcion, cargado_por, creado_en)
    values (v_org, 'multa', pg_temp.plata(pg_temp.entre(280000, 480000) * pg_temp.precio(1, x, hoy), 1000), x, u.id, u.chofer_id,
      'Exceso de velocidad · ' || pg_temp.uno(array['Ruta Nacional 7','Ruta Nacional 9','Ruta Nacional 14','Ruta Nacional 34','Ruta Nacional 3']), v_admin, pg_temp.momento(x, 12));

    -- ───────────── Vencimientos ─────────────
    v_idx := 0;
    for u in select * from public.unidades where organizacion_id = v_org and estado <> 'baja' order by creado_en, dominio loop
      v_idx := v_idx + 1;
      insert into public.documentos (organizacion_id, tipo_documento_id, unidad_id, numero, vence, creado_en)
      values (v_org, v_tipos[1], u.id, 'RTO-' || pg_temp.ent(100000, 999999),
        case when v_idx = 5 then hoy - pg_temp.ent(2, 9) when v_idx = 6 then hoy + pg_temp.ent(4, 18) else hoy + pg_temp.ent(35, 330) end, now() - interval '160 days');
      insert into public.documentos (organizacion_id, tipo_documento_id, unidad_id, numero, vence, creado_en)
      values (v_org, v_tipos[2], u.id, 'Póliza ' || pg_temp.ent(1000000, 9999999),
        case when v_idx = 3 then hoy + pg_temp.ent(2, 12) else hoy + pg_temp.ent(40, 350) end, now() - interval '160 days');
      if u.tipo in ('tractor', 'chasis') then
        insert into public.documentos (organizacion_id, tipo_documento_id, unidad_id, numero, vence, creado_en)
        values (v_org, v_tipos[3], u.id, 'TAC-' || pg_temp.ent(10000, 99999), hoy + pg_temp.ent(30, 360), now() - interval '160 days');
      end if;
    end loop;
    for i in 1 .. array_length(v_choferes, 1) loop
      insert into public.documentos (organizacion_id, tipo_documento_id, chofer_id, numero, vence, creado_en)
      values (v_org, v_tipos[4], v_choferes[i], 'LINTI ' || pg_temp.ent(20000000, 42000000),
        case when i = 2 then hoy + pg_temp.ent(6, 20) when i = 4 and e.n % 2 = 0 then hoy - pg_temp.ent(1, 6) else hoy + pg_temp.ent(60, 700) end, now() - interval '160 days');
      if e.peligrosas and i <= 3 then
        insert into public.documentos (organizacion_id, tipo_documento_id, chofer_id, numero, vence, creado_en)
        values (v_org, v_tipos[5], v_choferes[i], 'CNRT-' || pg_temp.ent(10000, 99999), hoy + pg_temp.ent(25, 300), now() - interval '160 days');
      end if;
    end loop;

    -- Una invitación pendiente para un chofer nuevo.
    insert into public.invitaciones (organizacion_id, rol, nombre, creada_por, creada_en, vence)
    values (v_org, 'chofer', nombres[1 + (e.n * 5 + 3) % 40] || ' ' || apellidos[1 + (e.n * 9 + 21) % 40], v_admin, now() - interval '2 days', now() + interval '5 days');
  end loop;

  -- Fechas de la actividad: las altas del equipo y las invitaciones con su momento real.
  update public.auditoria a set creado_en = m.creado_en
  from public.miembros m where a.accion = 'miembro.alta' and a.organizacion_id = m.organizacion_id and a.recurso_id = m.user_id::text
    and a.organizacion_id::text like 'de000000-%';
  update public.auditoria set creado_en = now() - interval '2 days' where accion = 'invitacion.creada' and organizacion_id::text like 'de000000-%';

  drop table demo_empresa, demo_cuenta, demo_trabajo, demo_ot;
end $$;

-- Resumen de lo cargado.
select o.nombre as empresa,
  (select count(*) from public.unidades u where u.organizacion_id = o.id) as unidades,
  (select count(*) from public.choferes c where c.organizacion_id = o.id) as choferes,
  (select count(*) from public.miembros m where m.organizacion_id = o.id) as cuentas,
  (select count(*) from public.viajes v where v.organizacion_id = o.id) as viajes,
  (select count(*) from public.ordenes x where x.organizacion_id = o.id or x.proveedor_id = o.id) as ordenes,
  (select count(*) from public.gastos g where g.organizacion_id = o.id) as gastos,
  (select count(*) from public.neumaticos n where n.organizacion_id = o.id or n.proveedor_actual_id = o.id) as cubiertas
from public.organizaciones o where o.id::text like 'de000000-%' order by o.id;
