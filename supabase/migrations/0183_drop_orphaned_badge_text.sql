-- Limpieza: badge_text quedo huerfana de un intento anterior mal entendido
-- (0181, cuyo revert nunca se aplico por colision de version con el mismo
-- prefijo numerico -- supabase db push la salto en silencio). La funcion
-- get_active_plan_promotion ya se redefinio sin ella en 0182, esto solo
-- limpia la columna que quedo sin uso en la tabla.
alter table plan_promotions drop column if exists badge_text;
