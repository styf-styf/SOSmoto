-- Cambia plan_promotions de "una fila nueva por cada activación" a "una
-- fila por plan, para siempre", agregando remaining_days para poder
-- pausar/reanudar la campaña sin perder la cuenta regresiva:
--   - Activar por primera vez: remaining_days = duration_days.
--   - Desactivar (pausar): remaining_days -= dias transcurridos desde
--     activated_at (nunca baja de 0).
--   - Reactivar (reanudar): activated_at = now(), remaining_days queda igual
--     (no se reinicia a duration_days).
-- No afecta a los negocios que ya reclamaron un beneficio -- su expires_at
-- en business_subscriptions ya quedó fijo al momento de reclamar y no
-- depende de esta cuenta regresiva.

alter table plan_promotions add column remaining_days numeric;
update plan_promotions set remaining_days = duration_days where remaining_days is null;

-- Antes de esta migración se creaba una fila nueva en cada activación (para
-- pruebas ya hay varias filas por plan) -- nos quedamos solo con la más
-- reciente de cada plan antes de poder aplicar el unique constraint.
delete from plan_promotions pp
where pp.id not in (
  select distinct on (plan_id) id
  from plan_promotions
  order by plan_id, created_at desc
);

alter table plan_promotions add constraint plan_promotions_plan_id_key unique (plan_id);
