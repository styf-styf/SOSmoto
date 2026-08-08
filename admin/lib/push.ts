import { createAdminClient } from './supabase/admin';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createAdminClient();

  // Deja registro en `notifications` (bandeja del perfil) además del push --
  // antes esto solo mandaba el push, sin ningún rastro si se perdía (usuario
  // con push desactivado/token vencido). Mismo patrón que notifyUser() del
  // lado de la app (services/notifications.ts), replicado acá porque esta
  // ruta corre en el panel admin, no puede importar código de la app.
  const { error: insertError } = await supabase.from('notifications').insert({ user_id: userId, title, body, data });
  if (insertError) console.error('insert notification error', insertError);

  const { data: user } = await supabase.from('users').select('push_token').eq('id', userId).maybeSingle();
  const pushToken = user?.push_token;
  if (!pushToken) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, data }),
  });
}
