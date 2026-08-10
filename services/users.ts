import { supabase } from './supabase';
import type { User } from '../types/database';

// push_token no está en esta lista a propósito -- la columna ya no es
// seleccionable por authenticated/anon (ver migración 0154), y nada de la
// app necesita leerlo salvo notifyUser() (que usa la RPC dedicada
// get_push_token_for_notify en su lugar).
export const SAFE_USER_COLUMNS =
  'id, email, phone, full_name, role, avatar_url, created_at, is_limited, limitation_reason, notification_prefs, limited_by, limited_at, legal_ack_at';

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select(SAFE_USER_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as User | null;
}

export interface UpdateUserProfileParams {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export async function updateUserProfile(userId: string, params: UpdateUserProfileParams): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...(params.fullName !== undefined ? { full_name: params.fullName } : {}),
      ...(params.phone !== undefined ? { phone: params.phone } : {}),
      ...(params.avatarUrl !== undefined ? { avatar_url: params.avatarUrl } : {}),
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

// Vía la vista `public_profiles` (migración 0145), no la tabla `users`
// directo -- expone solo nombre/avatar sin importar relación con quien
// pregunta (a diferencia de email/teléfono, que sí requieren una relación
// real). Reemplaza el join embebido que antes se hacía directo a `users`
// en posts/historias/comentarios -- ver services/posts.ts y stories.ts.
export async function getUsersByIds(
  ids: string[]
): Promise<Array<{ id: string; full_name: string; avatar_url: string | null }>> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', ids);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>;
}

export async function searchClients(
  query: string
): Promise<Array<{ id: string; full_name: string; avatar_url: string | null }>> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('role', 'client')
    .ilike('full_name', `%${query.trim()}%`)
    .limit(6);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>;
}

// Última ubicación conocida (país/región/ciudad) -- exclusivamente para la
// métrica interna del admin, nunca se lee de vuelta desde la app (las
// columnas quedan fuera del grant select de authenticated/anon a propósito,
// ver migración 0203). Por eso este update no encadena .select(): un
// select('*') implícito fallaría con "permission denied for column" contra
// esas mismas columnas que se acaban de escribir.
export async function updateLastKnownLocation(
  userId: string,
  location: { country: string; region: string | null; city: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      last_location_country: location.country,
      last_location_region: location.region,
      last_location_city: location.city,
      last_location_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;

  // Cambiar la contraseña por sí solo no invalida sesiones ya abiertas en
  // otros dispositivos (comportamiento conocido de Supabase Auth: el
  // refresh token no expira por tiempo, solo al usarse o al revocarlo
  // explícito) -- si alguien cambia su contraseña porque sospecha que le
  // robaron la sesión, sin esto el atacante seguiría adentro. 'others'
  // cierra todas las demás sesiones sin desloguear el dispositivo actual.
  await supabase.auth.signOut({ scope: 'others' });
}

export async function changeRoleToClient(): Promise<void> {
  const { error } = await supabase.rpc('change_role_to_client');
  if (error) throw error;
}
