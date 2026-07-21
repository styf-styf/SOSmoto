-- Pausar una campaña no debe ser lo mismo que cancelarla para siempre --
-- pauseAd() ponía status='expired' (el mismo estado terminal de una
-- campaña vencida por tiempo), sin ninguna forma de reanudar salvo pagando
-- de nuevo ("Relanzar"). Ahora existe un estado 'paused' real; paused_at
-- guarda cuándo se pausó para poder correr ends_at hacia adelante al
-- reanudar (sin esto, el negocio perdería los días ya pagados que estuvo
-- pausada).
alter type ad_status add value 'paused';
alter table ads add column paused_at timestamptz;
