import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.112.2';

// Asistente unificado (cliente y negocio): mismo modelo/razonamiento, lo que
// cambia por rol es el CONTEXTO real inyectado en el system prompt en cada
// turno (buildClientContext / buildBusinessContext). Sin RAG todavía. Sin
// loop de tool-use: "inyección de contexto" + "salida estructurada"
// (output_config.format json_schema) para forzar {reply, suggested_action}
// -- el asistente NUNCA ejecuta la acción sugerida, solo la propone.

// claude-opus-4-8 es el más capaz (recomendado por defecto). Si el costo
// importa más que la profundidad de razonamiento, cambiar a 'claude-sonnet-5'
// (~40% más barato: $3/$15 vs $5/$25 por MTok input/output) -- decisión
// explícita del dueño del proyecto, por eso queda aislada en esta constante.
const CLAUDE_MODEL = 'claude-opus-4-8';

const HISTORY_LIMIT = 20;
const MAX_INPUT_CHARS = 2000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

const AI_CHAT_ACTION_TYPES = [
  'solicitar_auxilio',
  'buscar_taller',
  'ver_producto',
  'ver_servicio',
  'ir_a_catalogo',
  'ir_a_estadisticas',
  'crear_campania_publicidad',
  'ver_informe',
] as const;

// La API de Claude no soporta minLength/maxLength ni constraints numéricos en
// este subset de JSON Schema, y todo objeto necesita additionalProperties:
// false. Para "nullable" se usa anyOf (sí soportado).
const NULLABLE_STRING = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    suggested_action: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...AI_CHAT_ACTION_TYPES] },
            label: { type: 'string' },
            params: {
              type: 'object',
              properties: {
                service_name: NULLABLE_STRING,
                product_id: NULLABLE_STRING,
                service_id: NULLABLE_STRING,
                report_id: NULLABLE_STRING,
                business_id: NULLABLE_STRING,
              },
              required: ['service_name', 'product_id', 'service_id', 'report_id', 'business_id'],
              additionalProperties: false,
            },
          },
          required: ['type', 'label', 'params'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['reply', 'suggested_action'],
  additionalProperties: false,
};

function buildSystemPrompt(
  role: 'client' | 'business',
  businessType: 'workshop' | 'store' | 'brand_advertiser' | null,
  context: Record<string, unknown>
): string {
  const contextJson = JSON.stringify(context, null, 2);

  const actionsCatalog = `
Tipos de acción disponibles en "suggested_action.type" (usa el que mejor calce, o deja "suggested_action": null si ninguna aplica -- no inventes una solo por rellenar el campo):
- solicitar_auxilio: el cliente necesita auxilio en carretera ahora mismo. Lleva a la pantalla de Auxilio -- el usuario elige vehículo/ubicación y confirma ahí, tú NUNCA creas la solicitud.
- buscar_taller: el usuario quiere encontrar un taller/tienda cercano (opcionalmente filtrado por un servicio en params.service_name, ej. "cambio de aceite").
- ver_producto: hay un producto específico relevante en el contexto (usa params.product_id con el id REAL, nunca inventado).
- ver_servicio: hay un servicio específico relevante en el contexto (usa params.service_id con el id REAL).
- ir_a_catalogo: el negocio quiere gestionar su propio catálogo, o el cliente quiere ver el catálogo completo de un negocio (usa params.business_id si aplica).
- ir_a_estadisticas: el negocio quiere ver sus métricas/estadísticas detalladas (solo negocios).
- crear_campania_publicidad: el negocio/marca quiere armar o pagar una campaña de publicidad (solo negocios).
- ver_informe: hay un informe de servicio específico relevante (usa params.report_id con el id REAL).
Deja en null los campos de params que no apliquen: nunca los omitas (el esquema los requiere a todos).`;

  const safetyDisclaimer = `
REGLAS DE SEGURIDAD (nunca las rompas):
- Nunca reemplaces el criterio de un mecánico certificado en fallas críticas de seguridad: frenos, fugas de combustible, dirección/manubrio, neumáticos lisos o dañados, testigos de advertencia del motor, olor a quemado, humo. Ante cualquiera de estas, SIEMPRE recomienda detenerse y acudir a un taller o pedir auxilio -- nunca digas que es seguro seguir conduciendo así.
- No inventes datos que no estén en "DATOS REALES" abajo (vehículos, kilometraje, precios, métricas, reseñas, ids). Si no tienes el dato, dilo con honestidad.
- No ejecutas ninguna acción por tu cuenta. Solo puedes SUGERIR una acción con "suggested_action"; el usuario decide si la ejecuta tocando el botón.
- Responde siempre en español de Ecuador, tono cercano y profesional, breve (2-4 frases salvo que el usuario pida más detalle).`;

  if (role === 'client') {
    return `Eres el Asistente virtual de SOSmoto, una app ecuatoriana que conecta motociclistas con talleres/tiendas y ofrece auxilio en carretera.

Hablas con un CLIENTE (motociclista). Puedes ayudarle a:
1. Diagnosticar problemas técnicos de forma guiada: distingue qué puede resolver él mismo (ej. revisar nivel de aceite, presión de llantas) de lo que necesita un taller.
2. Explicar en lenguaje simple un informe de servicio pasado (revisa "recent_service_reports": services_performed, recommendations, next_maintenance_km/date).
3. Ayudarlo a decidir entre comprar un producto o pedir un servicio, comparando precio real del catálogo si el contexto lo trae.
4. Conversar proactivamente sobre mantenimiento pendiente ("maintenance_due") -- si hay uno vencido o próximo, menciónalo aunque no pregunte directamente.
5. Resolver dudas de cómo funciona la app.

DATOS REALES DEL USUARIO (usa esto, no inventes datos):
${contextJson}
${actionsCatalog}
${safetyDisclaimer}`;
  }

  const businessTypeLabel =
    businessType === 'workshop'
      ? 'taller mecánico'
      : businessType === 'store'
        ? 'tienda de accesorios/repuestos'
        : 'marca/proveedor anunciante';

  return `Eres el Asistente virtual de SOSmoto, una app ecuatoriana que conecta motociclistas con talleres/tiendas y ofrece auxilio en carretera.

Hablas con un NEGOCIO de tipo "${businessType}" (${businessTypeLabel}). Puedes ayudarle a:
1. Diagnosticar problemas que le describan sus clientes -- mismo razonamiento que con un cliente final, pero puedes asumir que este negocio SÍ tiene herramienta y experiencia.
2. Explicar sus propias métricas de "Crece tu negocio" ("stats", "growth_suggestion") en lenguaje natural y accionable.
3. Ayudar a redactar una respuesta profesional a una reseña negativa -- usa "recent_reviews", nunca inventes una reseña que no esté ahí.
4. Soporte operativo: dudas de cómo funciona la app, ya conociendo su plan/configuración real.
5. Ayudar a armar una campaña de publicidad usando los precios reales en "ad_pricing".
6. Ayudar a definir escalones de precio por volumen -- usa "top_products" con sus price_tiers reales.
${businessType === 'workshop' ? '' : 'Nota: este negocio no maneja auxilio en carretera -- no sugieras ese flujo ni la acción solicitar_auxilio.\n'}
DATOS REALES DEL NEGOCIO (usa esto, no inventes datos):
${contextJson}
${actionsCatalog}
${safetyDisclaimer}`;
}

async function buildClientContext(supabase: SupabaseClient, userId: string) {
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, plate, current_mileage, moto_type, avg_monthly_km')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (vehiclesError) throw vehiclesError;

  const vehicleList = vehicles ?? [];
  const vehicleIds = vehicleList.map((v) => v.id);

  let maintenanceDue: Array<Record<string, unknown>> = [];
  if (vehicleIds.length > 0) {
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('maintenance_suggestions')
      .select('id, vehicle_id, due_at_km, status, rule_id')
      .in('vehicle_id', vehicleIds)
      .in('status', ['notified', 'pending']);
    if (suggestionsError) throw suggestionsError;

    const ruleIds = Array.from(new Set((suggestions ?? []).map((s) => s.rule_id)));
    const { data: rules, error: rulesError } = ruleIds.length
      ? await supabase.from('maintenance_rules').select('id, service_name, interval_km').in('id', ruleIds)
      : { data: [] as Array<{ id: string; service_name: string; interval_km: number | null }>, error: null };
    if (rulesError) throw rulesError;

    const ruleById = new Map((rules ?? []).map((r) => [r.id, r]));
    const vehicleById = new Map(vehicleList.map((v) => [v.id, v]));

    maintenanceDue = (suggestions ?? []).map((s) => {
      const rule = ruleById.get(s.rule_id);
      const vehicle = vehicleById.get(s.vehicle_id);
      return {
        vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}` : null,
        service_name: rule?.service_name ?? null,
        due_at_km: s.due_at_km,
        km_remaining: vehicle && s.due_at_km !== null ? s.due_at_km - vehicle.current_mileage : null,
        status: s.status,
      };
    });
  }

  const { data: activeHelpRequest, error: helpRequestError } = await supabase
    .from('help_requests')
    .select('id, status, created_at')
    .eq('client_id', userId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (helpRequestError) throw helpRequestError;

  const { data: recentReports, error: reportsError } = await supabase
    .from('service_reports')
    .select('id, business_id, services_performed, recommendations, next_maintenance_km, next_maintenance_date, created_at')
    .eq('client_id', userId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(5);
  if (reportsError) throw reportsError;

  return {
    vehicles: vehicleList.map((v) => ({
      id: v.id,
      label: `${v.brand} ${v.model} ${v.year}`,
      plate: v.plate,
      current_mileage: v.current_mileage,
      moto_type: v.moto_type,
    })),
    maintenance_due: maintenanceDue,
    active_help_request: activeHelpRequest ?? null,
    recent_service_reports: recentReports ?? [],
  };
}

async function resolveWorkBusiness(supabase: SupabaseClient, userId: string) {
  const { data: owned, error: ownedError } = await supabase.from('businesses').select('*').eq('owner_id', userId).maybeSingle();
  if (ownedError) throw ownedError;
  if (owned) return owned;

  const { data: employee, error: employeeError } = await supabase
    .from('business_employees')
    .select('businesses(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (employeeError) throw employeeError;
  return (employee as { businesses: Record<string, unknown> } | null)?.businesses ?? null;
}

async function buildBusinessContext(supabase: SupabaseClient, business: Record<string, any>) {
  const [
    { data: plan, error: planError },
    { data: growth, error: growthError },
    { data: reviews, error: reviewsError },
    { data: products, error: productsError },
    { data: services, error: servicesError },
    { data: adPricing, error: adPricingError },
  ] = await Promise.all([
    business.plan_id
      ? supabase.from('subscription_plans').select('name, max_products, max_services').eq('id', business.plan_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('growth_suggestions')
      .select('type, title, body')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('rating, comment, created_at')
      .eq('reviewed_business_id', business.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('products')
      .select('id, name, reference_price, stock, min_order_quantity, price_tiers')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(10),
    supabase
      .from('services')
      .select('id, name, reference_price')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('views', { ascending: false })
      .limit(10),
    supabase.from('ad_pricing').select('price_per_day_city, price_per_day_national').maybeSingle(),
  ]);
  if (planError) throw planError;
  if (growthError) throw growthError;
  if (reviewsError) throw reviewsError;
  if (productsError) throw productsError;
  if (servicesError) throw servicesError;
  if (adPricingError) throw adPricingError;

  const [
    { count: helpRequestsTotal, error: hrTotalError },
    { count: helpRequestsCompleted, error: hrCompletedError },
    { count: appointmentsTotal, error: apptTotalError },
    { count: appointmentsCompleted, error: apptCompletedError },
    { data: ads, error: adsError },
  ] = await Promise.all([
    supabase.from('help_requests').select('*', { count: 'exact', head: true }).eq('accepted_business_id', business.id),
    supabase
      .from('help_requests')
      .select('*', { count: 'exact', head: true })
      .eq('accepted_business_id', business.id)
      .eq('status', 'completed'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'completed'),
    supabase.from('ads').select('impressions, clicks').eq('business_id', business.id),
  ]);
  if (hrTotalError) throw hrTotalError;
  if (hrCompletedError) throw hrCompletedError;
  if (apptTotalError) throw apptTotalError;
  if (apptCompletedError) throw apptCompletedError;
  if (adsError) throw adsError;

  return {
    business: {
      id: business.id,
      name: business.name,
      business_type: business.business_type,
      city: business.city,
      rating_avg: business.rating_avg,
      followers_count: business.followers_count,
      plan_name: (plan as { name?: string } | null)?.name ?? 'free',
      aid_radius_km: business.aid_radius_km,
    },
    growth_suggestion: growth ?? null,
    recent_reviews: reviews ?? [],
    top_products: products ?? [],
    top_services: services ?? [],
    ad_pricing: adPricing ?? null,
    stats: {
      help_requests_total: helpRequestsTotal ?? 0,
      help_requests_completed: helpRequestsCompleted ?? 0,
      appointments_total: appointmentsTotal ?? 0,
      appointments_completed: appointmentsCompleted ?? 0,
      ad_impressions: (ads ?? []).reduce((sum, a) => sum + a.impressions, 0),
      ad_clicks: (ads ?? []).reduce((sum, a) => sum + a.clicks, 0),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401);

    // Pendiente del usuario: hasta configurar ANTHROPIC_API_KEY como secret,
    // responde 503 controlado en vez de tronar (mismo espíritu que Resend/Correos).
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return json(
        { error: 'El asistente de IA todavía no está configurado (falta ANTHROPIC_API_KEY). Vuelve más tarde.' },
        503
      );
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return json({ error: 'Mensaje vacío' }, 400);
    if (text.length > MAX_INPUT_CHARS) {
      return json({ error: `Mensaje demasiado largo (máx. ${MAX_INPUT_CHARS} caracteres)` }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: 'Perfil no encontrado' }, 404);
    if (profile.role === 'admin') {
      return json({ error: 'El asistente no está disponible para administradores.' }, 403);
    }

    let systemPrompt: string;
    if (profile.role === 'client') {
      const context = await buildClientContext(supabase, profile.id);
      systemPrompt = buildSystemPrompt('client', null, context);
    } else {
      const business = await resolveWorkBusiness(supabase, profile.id);
      if (!business) {
        return json({ error: 'Primero completa el registro de tu negocio para usar el asistente.' }, 400);
      }
      const context = await buildBusinessContext(supabase, business);
      systemPrompt = buildSystemPrompt('business', business.business_type, context);
    }

    const { data: historyRows, error: historyError } = await supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (historyError) throw historyError;
    const history = (historyRows ?? []).reverse();

    const anthropicMessages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ];

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    let reply = 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo en unos segundos.';
    let suggestedAction: Record<string, unknown> | null = null;

    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt }],
        messages: anthropicMessages,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      });

      if (response.stop_reason === 'refusal') {
        reply =
          'No puedo ayudarte con esa solicitud. Si es una emergencia de seguridad (frenos, fugas de combustible, etc.), detente y acude a un taller certificado o pide auxilio desde la app.';
      } else {
        const textBlock = response.content.find((b) => b.type === 'text') as
          | { type: 'text'; text: string }
          | undefined;
        if (textBlock?.text) {
          const parsed = JSON.parse(textBlock.text);
          if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
            reply = parsed.reply;
          }
          if (parsed.suggested_action && typeof parsed.suggested_action === 'object') {
            suggestedAction = parsed.suggested_action;
          }
        }
      }
    } catch (aiError) {
      console.error('anthropic error', aiError);
      reply = 'Hubo un problema al conectar con el asistente. Intenta de nuevo en unos segundos.';
    }

    const { data: userMessage, error: userInsertError } = await supabase
      .from('ai_chat_messages')
      .insert({ user_id: profile.id, role: 'user', content: text, action: null })
      .select()
      .single();
    if (userInsertError) throw userInsertError;

    const { data: assistantMessage, error: assistantInsertError } = await supabase
      .from('ai_chat_messages')
      .insert({ user_id: profile.id, role: 'assistant', content: reply, action: suggestedAction })
      .select()
      .single();
    if (assistantInsertError) throw assistantInsertError;

    return json({ userMessage, assistantMessage });
  } catch (err) {
    console.error('ai-assistant error', err);
    return json({ error: String(err) }, 500);
  }
});
