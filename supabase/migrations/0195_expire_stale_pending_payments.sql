-- payphone-prepare inserta el pago en 'pending' apenas se abre el checkout,
-- antes de que el negocio vea el widget de Payphone -- si lo abandona sin
-- terminar (cierra la pestaña, pierde conexión, nunca llega a pagar),
-- payphone-confirm nunca se llama y esa fila queda en 'pending' para
-- siempre, sin ningún job que la revise. Es justo lo que producía el ruido
-- en el contador "Pagos atascados" del admin (Inicio/Piloto).
--
-- 'failed' no aplica ningún otro efecto (no toca business_subscriptions ni
-- businesses.plan_id, ver payphone-confirm) -- un pago abandonado y uno
-- explícitamente rechazado por Payphone terminan exactamente igual: el
-- negocio se queda en el plan que ya tenía.
--
-- 2 horas de margen (el doble del umbral de "atascado" que ya usa el
-- admin para detectarlos) para no cerrar de golpe un pago que legítimamente
-- sigue en curso. Mismo patrón de cron SQL directo (sin Edge Function) que
-- expire-plan-promotion-windows (0180) y expire-stale-ads (0111), al ser
-- pura actualización de tabla sin lógica adicional.
select cron.schedule(
  'expire-stale-pending-payments',
  '0 * * * *',
  $$
  update payments
  set status = 'failed'
  where status = 'pending'
    and created_at < now() - interval '2 hours';
  $$
);
