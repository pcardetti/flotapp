-- Flotapp · saca las empresas de muestra de empresas_demo.sql, con sus cuentas, y nada más.
-- Se reconocen por su identificador (empiezan con de000000-) y las cuentas por su mail @flotapp.test.
-- Se ejecuta en Supabase → SQL Editor; se puede correr más de una vez.

do $$
declare
  v_orgs uuid[] := array(select id from public.organizaciones where id::text like 'de000000-%');
  v_cuentas int;
begin
  -- Primero lo que apunta a unidades, cubiertas o a otra de las empresas (el taller y la recapadora).
  delete from public.neumatico_eventos where organizacion_id = any (v_orgs);
  delete from public.neumaticos where organizacion_id = any (v_orgs);
  delete from public.viajes where organizacion_id = any (v_orgs);
  delete from public.ordenes where organizacion_id = any (v_orgs);
  delete from public.organizaciones where id = any (v_orgs);
  delete from auth.users where id::text like 'de00a000-%' and email like '%@flotapp.test';
  get diagnostics v_cuentas = row_count;
  raise notice 'Se borraron % empresas de muestra y % cuentas.', coalesce(array_length(v_orgs, 1), 0), v_cuentas;
end $$;
