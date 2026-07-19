-- Marca como 'expired' las campañas activas que ya pasaron su ends_at --
-- antes esto nunca se actualizaba solo (ver conversación: el admin las
-- seguía viendo como "Activas" aunque ya no se mostraran a nadie). Mismo
-- patrón directo-por-SQL que cleanup-expired-stories (0074), corre cada hora.
select cron.schedule(
  'expire-stale-ads',
  '0 * * * *',
  $$
    update public.ads
    set status = 'expired'
    where status = 'active'
      and ends_at < now();
  $$
);
