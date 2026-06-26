import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Llamada publica desde el portal web (sin sesion todavia) para canjear el
// codigo de un solo uso emitido por web-login-ticket por una sesion real de
// Supabase. La seguridad viene del codigo mismo: un UUID random, de un solo
// uso (se marca usado atomicamente), que expira en 2 minutos.
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
    const { code } = await req.json();
    if (!code) return json({ error: 'Falta el código' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Reclamo atomico: solo gana esta llamada si el ticket sigue sin usarse
    // y no ha expirado. Evita que el mismo codigo se use dos veces.
    const { data: claimed, error: claimError } = await supabase
      .from('web_login_tickets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
      .maybeSingle();

    if (claimError || !claimed) {
      return json({ error: 'Código inválido, ya usado, o expirado' }, 400);
    }

    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(claimed.user_id);
    if (userError || !userResult.user?.email) {
      return json({ error: 'Usuario no encontrado' }, 404);
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userResult.user.email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      return json({ error: 'No se pudo generar la sesión' }, 500);
    }

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (verifyError || !verifyData.session) {
      return json({ error: 'No se pudo crear la sesión' }, 500);
    }

    return json({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
