import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Lee/edita la fila única de ad_pricing (precio de publicidad) desde el
// panel admin. Mismo motivo que admin-campaigns para no llamar a
// `sb.from('ads'...)` directo desde el navegador -- acá no aplica ("ads" no
// aparece en la URL), pero se mantiene el mismo patrón de proxy con service
// role + verificación de rol admin para todas las tablas que el admin edita.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'No autenticado' }, 401);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: callerRow } = await supabase.from('users').select('role').eq('id', userData.user.id).maybeSingle();
    if (!callerRow || callerRow.role !== 'admin') {
      return json({ error: 'No autorizado' }, 403);
    }

    const { action, prices } = await req.json();

    if (action === 'get') {
      const { data, error } = await supabase
        .from('ad_pricing')
        .select('price_per_day_city, price_per_day_national, radius_reference_km, radius_cap_km')
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ pricing: data });
    }

    if (action === 'update') {
      const city = Number(prices?.price_per_day_city);
      const national = Number(prices?.price_per_day_national);
      const referenceKm = Number(prices?.radius_reference_km);
      const capKm = Number(prices?.radius_cap_km);

      if (![city, national, referenceKm, capKm].every((n) => Number.isFinite(n) && n > 0)) {
        return json({ error: 'Todos los valores deben ser números mayores a 0.' }, 400);
      }
      // El precio de Ciudad nunca puede superar al de País, y viceversa el de
      // País nunca puede quedar por debajo del de Ciudad -- es la misma
      // comparación, pero ambas dan el mismo resultado: si se rompe, el radio
      // (que interpola entre los dos) quedaría con una tarifa que baja al
      // subir los km, algo que no tiene sentido para el negocio que paga.
      if (city > national) {
        return json({ error: 'El precio de Ciudad no puede ser mayor al de País (ni el de País menor al de Ciudad).' }, 400);
      }
      if (referenceKm >= capKm) {
        return json({ error: 'El "radio de referencia" debe ser menor al "radio tope".' }, 400);
      }

      const { error } = await supabase
        .from('ad_pricing')
        .update({
          price_per_day_city: city,
          price_per_day_national: national,
          radius_reference_km: Math.round(referenceKm),
          radius_cap_km: Math.round(capKm),
        })
        .eq('id', true);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
