-- El revoke de columna de 0154 (push_token) resultó ser un no-op: ya
-- existía un `grant select on users to authenticated, anon` a nivel de
-- TABLA (otorgado en algún momento anterior a 0002), y en Postgres un
-- `revoke select (columna) ... from rol` solo cancela un grant que se
-- haya dado ANTES a esa MISMA granularidad de columna -- no puede "restar"
-- una columna de un grant más amplio ya existente a nivel de tabla.
-- Verificado con pg_attribute.attacl (null = nunca se creó ninguna ACL de
-- columna, la revocación no tuvo ningún efecto real).
--
-- Mismo problema, mismo no-op, en el revoke de impressions/clicks de `ads`
-- en la migración 0142 -- ese SÍ queda pendiente de arreglar aparte (los
-- call sites de `ads` son más numerosos y necesitan su propio mapeo
-- owner-vs-público antes de tocar el grant, igual que se hizo acá para
-- `users`; no se apura en esta migración).
--
-- Fix correcto: revocar el grant de TABLA completo y volver a otorgar
-- selección explícita columna por columna, excluyendo push_token. Esto no
-- amplía el acceso de fila de nadie -- RLS sigue decidiendo exactamente
-- las mismas filas visibles que antes, esto solo decide qué columnas son
-- seleccionables dentro de esas filas ya visibles.
--
-- services/users.ts (getUserById, SAFE_USER_COLUMNS) y
-- hooks/AuthContext.tsx (fetch de perfil propio) ya se actualizaron para
-- pedir columnas explícitas en vez de `select('*')` -- con el grant de
-- tabla completo revocado, cualquier `select('*')` contra `users` bajo
-- auth normal (no service_role) fallaría con "permission denied for
-- column push_token" sin ese cambio.
revoke select on users from authenticated, anon;
grant select (
  id, email, phone, full_name, role, avatar_url, created_at,
  is_limited, limitation_reason, notification_prefs,
  limited_by, limited_at, legal_ack_at
) on users to authenticated, anon;
