import { supabase } from './supabase';
import type { NotificationCategory, NotificationPrefs } from '../types/database';

export async function updatePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  if (error) throw error;
}

// push_token ya no se puede leer directo de `users` (columna revocada, ver
// migración 0154) -- esta función RPC solo devuelve el token si existe una
// relación real entre quien llama y userId (mismas reglas que
// can_notify_user), para que un push jamás salga hacia alguien sin
// ninguna relación con el destinatario.
export async function getPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_push_token_for_notify', { p_target_user_id: userId });
  if (error) throw error;
  return data ?? null;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.notification_prefs as NotificationPrefs) ?? {};
}

export async function updateNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  const { error } = await supabase.from('users').update({ notification_prefs: prefs }).eq('id', userId);
  if (error) throw error;
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data }),
    });
    const result = await response.json();
    if (!response.ok || result.errors?.length) {
      console.error('expo push error', result.errors ?? result);
    }
  } catch (err) {
    console.error('send push notification error', err);
  }
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export async function getMyNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  category?: NotificationCategory
): Promise<void> {
  // Deja registro en `notifications` (para la bandeja del perfil) además de
  // mandar el push -- un fallo al guardar el registro no debe impedir que el
  // push salga, y la preferencia de categoría solo apaga el push, nunca el
  // registro en la bandeja (el usuario sigue viendo su historial completo).
  supabase
    .from('notifications')
    .insert({ user_id: userId, title, body, data: data ?? null })
    .then(({ error }) => {
      if (error) console.error('insert notification error', error);
    });

  const { data: userRow, error } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  const prefs = (userRow?.notification_prefs as NotificationPrefs) ?? {};
  if (category && prefs[category] === false) return;

  // push_token ya no se lee directo (columna revocada, ver migración 0154) --
  // esta RPC devuelve null si no hay relación real con userId, cerrando el
  // hueco de mandar pushes a cualquiera solo por tener SU push_token en
  // crudo vía alguna policy de relación en `users`.
  const { data: pushToken, error: tokenError } = await supabase.rpc('get_push_token_for_notify', {
    p_target_user_id: userId,
  });
  if (tokenError) {
    console.error('get push token error', tokenError);
    return;
  }
  if (!pushToken) return;

  await sendPushNotification(pushToken, title, body, data);
}
