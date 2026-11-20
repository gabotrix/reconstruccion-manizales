-- Cifras públicas en vivo para la página del Plan de Recuperación (19-nov-2026).
-- Solo cifras sumadas: ni nombres, ni cédulas, ni direcciones, ni números prediales.
-- Se corre con sql-cambio; se puede correr dos veces sin dañar nada.

-- Asignaciones ARP = oficio generado (así las llama la sala desde el 19-nov).
--   Edificaciones: arp_socializacion con oficio. Comercio: comercio_casos con oficio.
--   Por comuna: la del predio de la visita; el comercio, por sus coordenadas o, si no, por su barrio.
create or replace function public.publico_arp()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with viv as (
    select s.oficio_valor v,
           case when p.comuna ~ '^\d{2} ' then (left(p.comuna, 2)::int)::text
                when substr(coalesce(vi.id22, left(vi.npn_unidad, 22)), 6, 2) = '00' then 'rural'
                else 'sin_ubicar' end k
      from public.arp_socializacion s
      join public.visitas vi on vi.id = s.visita_id
      left join public.predios p on p.id22 = coalesce(vi.id22, left(vi.npn_unidad, 22))
     where s.oficio_en is not null),
  com as (
    select c.oficio_en, c.oficio_valor v, c.nivel,
           case when coalesce(g.comuna, b.comuna) ~ '^\d{2} ' then (left(coalesce(g.comuna, b.comuna), 2)::int)::text
                else 'sin_ubicar' end k
      from public.comercio_casos c
      left join lateral (
        select ba.comuna from public.barrios_alcaldia ba
         where c.latitud is not null and c.longitud is not null
           and st_contains(ba.geom, st_setsrid(st_point(c.longitud::float8, c.latitud::float8), 4326))
         limit 1) g on true
      left join lateral (
        select ba.comuna from public.barrios_alcaldia ba
         where c.barrio is not null
           and translate(upper(btrim(c.barrio)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')
               in (translate(upper(ba.nombre), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), translate(upper(ba.nombre_catastro), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'))
         limit 1) b on true),
  rep as (
    select k, count(*) asig, coalesce(sum(v), 0) valor from viv group by k),
  cmc as (
    select k,
           count(*) filter (where oficio_en is not null) asig,
           coalesce(sum(v) filter (where oficio_en is not null), 0) valor,
           count(*) filter (where nivel = 'SEVERO') severo,
           count(*) filter (where nivel = 'LEVE_MODERADO') leve
      from com group by k)
  select jsonb_build_object(
    'corte', now(),
    'asignaciones', jsonb_build_object(
      'edificaciones', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(v), 0)) from viv),
      'comercio', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(v), 0)) from com where oficio_en is not null)),
    'comunas', coalesce((
      select jsonb_object_agg(coalesce(r.k, m.k), jsonb_strip_nulls(jsonb_build_object(
               'rep', case when r.k is not null then jsonb_build_object('n', r.asig, 'valor', r.valor) end,
               'com', case when m.k is not null then jsonb_build_object('n', m.asig, 'valor', m.valor,
                        'severidad', jsonb_build_object('Severo', m.severo, 'Leve o moderado', m.leve)) end)))
        from rep r full join cmc m on m.k = r.k), '{}'::jsonb));
$$;

revoke all on function public.publico_arp() from public, anon, authenticated;
grant execute on function public.publico_arp() to service_role;

-- Caché de la respuesta de la función de borde cifras-publicas (publico_cifras tarda unos segundos):
-- la función la reusa 5 minutos. Solo la lee y escribe la llave de servicio.
create table if not exists public.publico_web_cache (
  clave text primary key,
  datos jsonb not null,
  en timestamptz not null default now()
);
alter table public.publico_web_cache enable row level security;
revoke all on public.publico_web_cache from anon, authenticated;
