-- Un taller/tienda que sigue a otra tienda (relación B2B, ver
-- BusinessProfileView "canBusinessFollowTarget") quedaba guardado por
-- client_id -- el id INDIVIDUAL de quien tocó "Seguir", no del negocio. Dos
-- empleados del mismo taller terminaban con listas de "Siguiendo" distintas
-- entre sí, y si uno se iba del equipo, las tiendas que él siguió no se
-- quedaban con el negocio. Se agrega follower_business_id: cuando está
-- seteado, el follow es del NEGOCIO (compartido por todo su equipo) en vez
-- de la persona. client_id se sigue guardando siempre (quién hizo la
-- acción, para auditoría), pero deja de ser la clave de identidad cuando
-- follower_business_id está presente. Los follows de cliente normal
-- (motociclista → negocio) no cambian -- siguen siendo por client_id,
-- follower_business_id se queda null.
alter table follows add column follower_business_id uuid references businesses(id) on delete cascade;
create index idx_follows_follower_business_id on follows(follower_business_id);

-- La unicidad plana (client_id, business_id) ya no sirve -- dos empleados
-- del mismo taller podían seguir la misma tienda cada uno por su cuenta
-- (dos filas legítimas antes del backfill de abajo), pero una vez migradas
-- a follower_business_id deben unificarse en una sola. Se reemplaza por dos
-- índices únicos parciales: uno por identidad de cliente (cuando no hay
-- negocio seguidor) y otro por identidad de negocio seguidor.
alter table follows drop constraint follows_client_id_business_id_key;
create unique index follows_client_uniq on follows(client_id, business_id) where follower_business_id is null;
create unique index follows_follower_business_uniq on follows(follower_business_id, business_id) where follower_business_id is not null;

-- Backfill: mapea cada client_id que tenga follows sin negocio asignado a
-- "en nombre de qué negocio actúa hoy" (dueño o empleado de un taller/
-- tienda) -- distinct porque una persona puede tener varios follows, pero
-- interesa una sola fila por client_id. No usa CTEs de escritura
-- encadenadas a propósito (dentro de un mismo statement todas ven el mismo
-- snapshot "antes", no se ven entre sí) -- se separa en pasos secuenciales
-- normales para poder razonar sobre el resultado con seguridad.
create temporary table _follow_business_map as
select distinct f.client_id,
  coalesce(
    (select b.id from businesses b where b.owner_id = f.client_id and b.business_type in ('workshop', 'store') limit 1),
    (select be.business_id from business_employees be join businesses b2 on b2.id = be.business_id
     where be.user_id = f.client_id and b2.business_type in ('workshop', 'store') limit 1)
  ) as follower_business_id
from follows f
where f.follower_business_id is null;

-- Por cada (negocio seguidor, negocio seguido), la fila más antigua entre
-- todos los compañeros de equipo que ya lo seguían gana y pasa a
-- representar al negocio.
update follows f
set follower_business_id = m.follower_business_id
from _follow_business_map m
where f.client_id = m.client_id
  and m.follower_business_id is not null
  and f.id = (
    select f2.id from follows f2
    join _follow_business_map m2 on m2.client_id = f2.client_id
    where m2.follower_business_id = m.follower_business_id
      and f2.business_id = f.business_id
    order by f2.created_at asc, f2.id asc
    limit 1
  );

-- El resto de filas que apuntaban al mismo (negocio seguidor, negocio
-- seguido) -- los duplicados de otros compañeros de equipo -- se
-- descartan, ya quedó una sola fila representando al negocio.
delete from follows f
using _follow_business_map m
where f.client_id = m.client_id
  and m.follower_business_id is not null
  and f.follower_business_id is null
  and exists (
    select 1 from follows winner
    where winner.follower_business_id = m.follower_business_id
      and winner.business_id = f.business_id
  );

drop table _follow_business_map;

-- RLS: además del caso client_id = auth.uid() (follow personal), permite
-- gestionar un follow del negocio a cualquier miembro de su staff.
drop policy follows_client_all on follows;
create policy follows_owner_manage on follows for all
  using (
    (follower_business_id is null and client_id = auth.uid())
    or (follower_business_id is not null and is_business_staff(follower_business_id))
  )
  with check (
    (follower_business_id is null and client_id = auth.uid())
    or (follower_business_id is not null and is_business_staff(follower_business_id))
  );
