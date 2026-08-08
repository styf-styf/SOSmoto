import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Corre una vez al dia (ver migracion de cron) y agarra a los usuarios cuya
// cuenta tiene entre 7 y 8 dias -- una ventana de exactamente un dia, para
// que cada usuario caiga en ella una sola vez en toda su vida (no hace
// falta una tabla de "ya se le mando" aparte).
const WINDOW_START_DAYS = 8;
const WINDOW_END_DAYS = 7;

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

async function recordNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, body, data });
  if (error) console.error('insert notification error', error);
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = Date.now();
    const windowStart = new Date(now - WINDOW_START_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now - WINDOW_END_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, push_token')
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd);
    if (error) throw error;

    const title = '¿Qué tal tu primera semana en SOSmoto?';
    const body = 'Estamos en piloto y tu opinión nos ayuda mucho -- cuéntanos qué mejorarías.';
    const data = { type: 'pilot_feedback_prompt' };

    let sent = 0;
    for (const user of users ?? []) {
      await recordNotification(supabase, user.id, title, body, data);
      if (user.push_token) {
        await sendPush(user.push_token, title, body, data);
        sent++;
      }
    }

    return new Response(JSON.stringify({ success: true, checked: users?.length ?? 0, sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
