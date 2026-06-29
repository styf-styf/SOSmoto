import { createAdminClient } from './supabase/admin';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createAdminClient();
  const { data: user } = await supabase.from('users').select('push_token').eq('id', userId).maybeSingle();
  const pushToken = user?.push_token;
  if (!pushToken) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, data }),
  });
}
