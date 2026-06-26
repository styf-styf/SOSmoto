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
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data }),
    });
  } catch (err) {
    console.error('send push notification error', err);
  }
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const token = await getPushToken(userId);
  if (!token) return;
  await sendPushNotification(token, title, body, data);
}
