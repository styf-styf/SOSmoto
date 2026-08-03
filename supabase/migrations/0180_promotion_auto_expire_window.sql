-- Hasta ahora la unica forma de cerrar la ventana de una promocion era el
-- toggle manual del admin. Se agrega un campo OPCIONAL de "ventana de
-- duracion" -- si se configura, la promocion se autoapaga sola al cumplirse
-- esos dias desde que se activo. Si se deja sin configurar (null), se
-- comporta exactamente como antes (manual-only).
--
-- Es un concepto DISTINTO de duration_days/remaining_days (que es la
-- garantia que recibe cada negocio al reclamar, fija, nunca cambia con el
-- tiempo) -- window_days/remaining_window_days es cuanto tiempo el admin
-- deja la oferta abierta para que negocios nuevos puedan reclamarla.
alter table plan_promotions
  add column window_days integer,
  add column remaining_window_days numeric;

-- Autoapaga las promociones cuya ventana ya se cumplio -- mismo patron de
-- cron SQL directo (sin Edge Function) que expire-stale-ads (0111) y
-- cleanup-expired-stories (0074), ya que es pura actualizacion de tabla.
-- Al autoapagar, congela remaining_days y remaining_window_days igual que
-- lo hace /api/promociones/desactivar al pausar manualmente.
select cron.schedule(
  'expire-plan-promotion-windows',
  '0 * * * *',
  $$
  update plan_promotions
  set is_active = false,
      remaining_days = greatest(0, remaining_days - extract(epoch from (now() - activated_at)) / 86400),
      remaining_window_days = 0,
      updated_at = now()
  where is_active
    and window_days is not null
    and remaining_window_days is not null
    and activated_at is not null
    and remaining_window_days - extract(epoch from (now() - activated_at)) / 86400 <= 0;
  $$
);
