import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIMEOUT_HOURS = 3;

interface StaleRequest {
  id: string;
  client_id: string;
  accepted_business_id: string | null;
  accepted_at: string | null;
}

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

async function getPushToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('push_token').eq('id', userId).maybeSingle();
  return (data as { push_token: string | null } | null)?.push_token ?? null;
}

// Cierra automáticamente los auxilios "accepted"/"in_progress" que nadie
// cerró (ni cliente ni taller) despues de TIMEOUT_HOURS -- sin esto, un
// auxilio olvidado deja al taller sin ver "Pendientes" nunca más y al
// cliente sin poder pedir uno nuevo, para siempre. Corre cada 15 min (ver
// migracion de cron), mismo patron que update-help-request-eta (0052).
Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const cutoff = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('help_requests')
    .select('id, client_id, accepted_business_id, accepted_at')
    .in('status', ['accepted', 'in_progress'])
    .lt('accepted_at', cutoff);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const requests = (data ?? []) as StaleRequest[];

  for (const request of requests) {
    await supabase
      .from('help_requests')
      .update({
        status: 'cancelled',
        admin_notes: 'Auto-cancelado por inactividad (sin cierre tras el tiempo límite).',
      })
      .eq('id', request.id);

    const clientToken = await getPushToken(supabase, request.client_id);
    if (clientToken) {
      await sendPush(
        clientToken,
        'Solicitud cerrada automáticamente',
        'Tu solicitud de auxilio se cerró por inactividad. Si todavía necesitas ayuda, pide un nuevo auxilio.',
        { type: 'help_request_expired', helpRequestId: request.id }
      );
    }

    if (request.accepted_business_id) {
      const { data: businessRow } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', request.accepted_business_id)
        .maybeSingle();
      const ownerId = (businessRow as { owner_id: string } | null)?.owner_id;
      const businessToken = ownerId ? await getPushToken(supabase, ownerId) : null;
      if (businessToken) {
        await sendPush(
          businessToken,
          'Auxilio cerrado automáticamente',
          'Este auxilio se cerró por inactividad. Ya puedes recibir y aceptar nuevas solicitudes.',
          { type: 'help_request_expired', helpRequestId: request.id }
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, expired: requests.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
