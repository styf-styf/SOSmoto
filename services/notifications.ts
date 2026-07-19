import { supabase } from './supabase';

export async function updatePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  if (error) throw error;
}

export async function getPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.push_token ?? null;
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
  data?: Record<string, unknown>
): Promise<void> {
  // Deja registro en `notifications` (para la bandeja del perfil) además de
  // mandar el push -- un fallo al guardar el registro no debe impedir que el
  // push salga.
  supabase
    .from('notifications')
    .insert({ user_id: userId, title, body, data: data ?? null })
    .then(({ error }) => {
      if (error) console.error('insert notification error', error);
    });

  const token = await getPushToken(userId);
  if (!token) return;
  await sendPushNotification(token, title, body, data);
}
