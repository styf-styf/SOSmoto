import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REMINDER_DAYS_BEFORE = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  expires_at: string | null;
  reminder_sent_at: string | null;
}

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();

  const { data: freePlan } = await supabase.from('subscription_plans').select('id').eq('name', 'free').single();

  const { data: subsData, error } = await supabase
    .from('business_subscriptions')
    .select('id, business_id, plan_id, expires_at, reminder_sent_at')
    .eq('status', 'active')
    .not('expires_at', 'is', null);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const subs = (subsData ?? []) as BusinessSubscription[];
  let notified = 0;
  let downgraded = 0;

  for (const sub of subs) {
    const expiresAt = new Date(sub.expires_at as string);
    const daysLeft = (expiresAt.getTime() - now.getTime()) / MS_PER_DAY;

    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', sub.business_id)
      .single();
    if (!business) continue;

    const { data: owner } = await supabase
      .from('users')
      .select('push_token, notification_prefs')
      .eq('id', business.owner_id)
      .maybeSingle();
    const pushToken: string | null = owner?.push_token ?? null;
    // Categoría 'pagos' de Configuración > Notificaciones -- solo apaga el
    // push, el downgrade/reversión de plan sigue pasando igual.
    const pagosEnabled = (owner?.notification_prefs as Record<string, boolean> | null)?.pagos !== false;

    if (daysLeft <= 0) {
      await supabase.from('business_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      if (freePlan) {
        await supabase.from('businesses').update({ plan_id: freePlan.id }).eq('id', sub.business_id);
      }
      if (pushToken && pagosEnabled) {
        await sendPush(
          pushToken,
          'Tu suscripción venció',
          'Tu plan pago venció y tu negocio volvió al plan Free. Renueva desde la app para recuperar tus beneficios.',
          { type: 'subscription_expired', businessId: sub.business_id }
        );
      }
      downgraded++;
      continue;
    }

    if (daysLeft <= REMINDER_DAYS_BEFORE && !sub.reminder_sent_at && pushToken && pagosEnabled) {
      await sendPush(
        pushToken,
        'Tu suscripción está por vencer',
        `Tu plan vence en ${Math.ceil(daysLeft)} día(s). Renueva desde la app para no perder tus beneficios.`,
        { type: 'subscription_expiring', businessId: sub.business_id }
      );
      await supabase.from('business_subscriptions').update({ reminder_sent_at: now.toISOString() }).eq('id', sub.id);
      notified++;
    }
  }

  return new Response(JSON.stringify({ ok: true, notified, downgraded }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
