import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Llamada desde la app (con la sesion normal del usuario) cuando abre el
// portal web de pagos, para evitar que tenga que loguearse de nuevo ahi.
// Devuelve un codigo de un solo uso, corta duracion, que el portal canjea
// por una sesion real en web-login-exchange. Nunca se expone el
// access_token/refresh_token real del usuario en la URL.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const { data: ticket, error } = await supabase
      .from('web_login_tickets')
      .insert({ user_id: userData.user.id, expires_at: expiresAt.toISOString() })
      .select('id')
      .single();

    if (error || !ticket) {
      return new Response(JSON.stringify({ error: 'No se pudo crear el código' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ code: ticket.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
