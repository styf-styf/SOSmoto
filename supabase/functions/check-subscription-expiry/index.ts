import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appButton, sendEmail } from '../_shared/resend.ts';

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

Deno.serve(async (req) => {
  // Solo el cron interno puede invocar esto -- ver nota equivalente en
  // check-maintenance/index.ts.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();

  // FIX: subscription_plans tiene una fila 'free' por business_type (6 en
  // total, ver 0119) -- .single() sin filtrar por tipo siempre fallaba acá
  // (2+ filas coinciden con name='free'), así que freePlan quedaba
  // undefined y el downgrade de plan_id de abajo nunca corría en la
  // práctica: el negocio quedaba con status='expired' en
  // business_subscriptions pero seguía con el plan_id pago en `businesses`.
  // Ahora se busca el plan free correspondiente al business_type de cada
  // negocio, dentro del loop.
  const { data: freePlans } = await supabase.from('subscription_plans').select('id, business_type').eq('name', 'free');
  const freePlanByType = new Map((freePlans ?? []).map((p: any) => [p.business_type, p.id]));

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
      .select('owner_id, business_type')
      .eq('id', sub.business_id)
      .single();
    if (!business) continue;

    const { data: owner } = await supabase
      .from('users')
      .select('push_token, email, notification_prefs')
      .eq('id', business.owner_id)
      .maybeSingle();
    const pushToken: string | null = owner?.push_token ?? null;
    const email: string | null = owner?.email ?? null;
    // Categoría 'pagos' de Configuración > Notificaciones -- solo apaga el
    // push, el downgrade/reversión de plan sigue pasando igual.
    const pagosEnabled = (owner?.notification_prefs as Record<string, boolean> | null)?.pagos !== false;

    if (daysLeft <= 0) {
      await supabase.from('business_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      const freePlanId = freePlanByType.get(business.business_type);
      if (freePlanId) {
        await supabase.from('businesses').update({ plan_id: freePlanId }).eq('id', sub.business_id);
      }
      if (pushToken && pagosEnabled) {
        await sendPush(
          pushToken,
          'Tu suscripción venció',
          'Tu plan pago venció y tu negocio volvió al plan Free. Renueva desde la app para recuperar tus beneficios.',
          { type: 'subscription_expired', businessId: sub.business_id }
        );
      }
      if (email && pagosEnabled) {
        await sendEmail(
          email,
          'Tu suscripción venció — volviste al plan Free',
          `<h2>Tu suscripción venció</h2>
<p>Tu plan pago venció y tu negocio volvió al plan Free. Renueva desde la app cuando quieras para recuperar tus beneficios (posición destacada, más productos/servicios en el catálogo, etc.).</p>
${appButton('pago-resultado', { tipo: 'subscription', ok: '1' })}`
        );
      }
      downgraded++;
      continue;
    }

    if (daysLeft <= REMINDER_DAYS_BEFORE && !sub.reminder_sent_at && pagosEnabled) {
      if (pushToken) {
        await sendPush(
          pushToken,
          'Tu suscripción está por vencer',
          `Tu plan vence en ${Math.ceil(daysLeft)} día(s). Renueva desde la app para no perder tus beneficios.`,
          { type: 'subscription_expiring', businessId: sub.business_id }
        );
      }
      if (email) {
        await sendEmail(
          email,
          'Tu suscripción está por vencer',
          `<h2>Tu suscripción está por vencer</h2>
<p>Tu plan vence en <strong>${Math.ceil(daysLeft)} día(s)</strong>. Renueva desde la app para no perder tus beneficios.</p>
${appButton('pago-resultado', { tipo: 'subscription', ok: '1' })}`
        );
      }
      await supabase.from('business_subscriptions').update({ reminder_sent_at: now.toISOString() }).eq('id', sub.id);
      notified++;
    }
  }

  return new Response(JSON.stringify({ ok: true, notified, downgraded }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
