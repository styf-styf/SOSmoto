import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const THROTTLE_DAYS = 7;
const NEAR_LIMIT_RATIO = 0.8;
const LOW_VISIBILITY_VIEWS = 20;
const LOW_VISIBILITY_FOLLOWERS = 5;
const NEW_BUSINESS_WINDOW_DAYS = 14;

interface BusinessRow {
  id: string;
  owner_id: string;
  business_type: string;
  is_limited: boolean;
  followers_count: number;
  created_at: string;
  plan_id: string;
}

interface PlanRow {
  id: string;
  name: string;
  max_products: number | null;
  max_services: number | null;
}

interface Suggestion {
  type: string;
  title: string;
  body: string;
}

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = new Date();
  let created = 0;

  const { data: businessesData, error: businessesError } = await supabase
    .from('businesses')
    .select('id, owner_id, business_type, is_limited, followers_count, created_at, plan_id')
    .in('business_type', ['workshop', 'store']);
  if (businessesError) {
    return new Response(JSON.stringify({ error: businessesError.message }), { status: 500 });
  }

  const { data: plansData, error: plansError } = await supabase
    .from('subscription_plans')
    .select('id, name, max_products, max_services');
  if (plansError) {
    return new Response(JSON.stringify({ error: plansError.message }), { status: 500 });
  }
  const plansById = new Map((plansData ?? []).map((p: PlanRow) => [p.id, p]));

  const businesses = (businessesData ?? []) as BusinessRow[];

  for (const business of businesses) {
    if (business.is_limited) continue;

    const plan = plansById.get(business.plan_id) as PlanRow | undefined;
    if (!plan) continue;

    const { data: recentSuggestion } = await supabase
      .from('growth_suggestions')
      .select('id, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentSuggestion) {
      const daysSince = (now.getTime() - new Date(recentSuggestion.created_at).getTime()) / MS_PER_DAY;
      if (daysSince < THROTTLE_DAYS) continue;
    }

    const { data: activeAd } = await supabase
      .from('ads')
      .select('id')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (plan.name === 'pro' && activeAd) continue;

    const suggestion = await findSuggestion(supabase, business, plan, now, !!activeAd);
    if (!suggestion) continue;

    await supabase.from('growth_suggestions').insert({
      business_id: business.id,
      type: suggestion.type,
      title: suggestion.title,
      body: suggestion.body,
    });
    created++;

    const { data: owner } = await supabase
      .from('users')
      .select('push_token, notification_prefs')
      .eq('id', business.owner_id)
      .maybeSingle();
    const pushToken: string | null = owner?.push_token ?? null;
    // Categoría 'upselling' de Configuración > Notificaciones -- la
    // sugerencia se sigue creando igual, solo se apaga el push.
    const upsellingEnabled = (owner?.notification_prefs as Record<string, boolean> | null)?.upselling !== false;
    if (pushToken && upsellingEnabled) {
      await sendPush(pushToken, suggestion.title, suggestion.body, { type: 'growth_suggestion', businessId: business.id });
    }
  }

  return new Response(JSON.stringify({ ok: true, created }), { headers: { 'Content-Type': 'application/json' } });
});

async function findSuggestion(
  supabase: ReturnType<typeof createClient>,
  business: BusinessRow,
  plan: PlanRow,
  now: Date,
  hasActiveAd: boolean
): Promise<Suggestion | null> {
  const planLabel = plan.name === 'free' ? 'Free' : plan.name === 'standard' ? 'Estándar' : 'Pro';

  if (plan.max_products !== null || plan.max_services !== null) {
    const [{ count: productCount }, { count: serviceCount }] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('is_active', true),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('is_active', true),
    ]);

    if (plan.max_products !== null && (productCount ?? 0) >= plan.max_products) {
      return {
        type: 'upgrade_plan_limit_reached',
        title: 'Llegaste al límite de tu plan',
        body: `Tu catálogo de productos alcanzó el máximo de tu plan ${planLabel}. Sube de plan para seguir agregando.`,
      };
    }
    if (plan.max_services !== null && (serviceCount ?? 0) >= plan.max_services) {
      return {
        type: 'upgrade_plan_limit_reached',
        title: 'Llegaste al límite de tu plan',
        body: `Tu catálogo de servicios alcanzó el máximo de tu plan ${planLabel}. Sube de plan para seguir agregando.`,
      };
    }
    if (plan.max_products !== null && (productCount ?? 0) >= plan.max_products * NEAR_LIMIT_RATIO) {
      return {
        type: 'upgrade_plan_near_limit',
        title: 'Te estás acercando al límite de tu plan',
        body: `Ya usas ${productCount}/${plan.max_products} productos de tu plan ${planLabel}. Sube de plan antes de quedarte sin espacio.`,
      };
    }
    if (plan.max_services !== null && (serviceCount ?? 0) >= plan.max_services * NEAR_LIMIT_RATIO) {
      return {
        type: 'upgrade_plan_near_limit',
        title: 'Te estás acercando al límite de tu plan',
        body: `Ya usas ${serviceCount}/${plan.max_services} servicios de tu plan ${planLabel}. Sube de plan antes de quedarte sin espacio.`,
      };
    }
  }

  if (!hasActiveAd) {
    const daysSinceCreated = (now.getTime() - new Date(business.created_at).getTime()) / MS_PER_DAY;
    if (daysSinceCreated <= NEW_BUSINESS_WINDOW_DAYS) {
      const { data: anyAd } = await supabase.from('ads').select('id').eq('business_id', business.id).limit(1).maybeSingle();
      if (!anyAd) {
        return {
          type: 'advertise_new_business',
          title: '¡Dale impulso a tu negocio nuevo!',
          body: 'Eres nuevo en SOSmoto. Anunciarte ahora te ayuda a conseguir tus primeros clientes más rápido.',
        };
      }
    }

    const [{ data: products }, { data: services }] = await Promise.all([
      supabase.from('products').select('views').eq('business_id', business.id),
      supabase.from('services').select('views').eq('business_id', business.id),
    ]);
    const totalViews =
      (products ?? []).reduce((sum: number, p: any) => sum + (p.views ?? 0), 0) +
      (services ?? []).reduce((sum: number, s: any) => sum + (s.views ?? 0), 0);

    if (totalViews < LOW_VISIBILITY_VIEWS || business.followers_count < LOW_VISIBILITY_FOLLOWERS) {
      return {
        type: 'advertise_low_visibility',
        title: 'Pocas visitas a tu perfil',
        body: 'Tu negocio tiene poca visibilidad últimamente. Una campaña de publicidad puede ayudarte a conseguir más clientes.',
      };
    }
  }

  return null;
}
