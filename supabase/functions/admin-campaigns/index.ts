import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Proxy para la cola de aprobación de publicidad del portal admin.
//
// El portal NO llama a `sb.from('ads')` directo desde el navegador porque
// muchos navegadores Android (Mi Browser/MIUI, Samsung Internet) traen un
// bloqueador de anuncios activado por defecto que bloquea cualquier URL que
// contenga el segmento "/ads" (ej. ".../rest/v1/ads?..."), sin importar que
// sea tráfico de Supabase y no de un ad-network real. Esta función evita ese
// problema: el navegador solo llama a "/functions/v1/admin-campaigns" (sin
// "ads" en la URL) y la consulta a la tabla `ads` ocurre del lado del
// servidor, con el service role.
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

    const { action, id, decision } = await req.json();

    if (action === 'list') {
      const { data, error } = await supabase
        .from('ads')
        .select('id, kind, item_name, title, photos, link_url, target_city, starts_at, ends_at, business_id, businesses(name)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ campaigns: data ?? [] });
    }

    if (action === 'review') {
      if (!id || !['active', 'rejected'].includes(decision)) {
        return json({ error: 'Datos inválidos' }, 400);
      }
      const { error } = await supabase.from('ads').update({ status: decision }).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
