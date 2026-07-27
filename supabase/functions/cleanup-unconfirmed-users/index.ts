import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UNCONFIRMED_TTL_HOURS = 48;
const PAGE_SIZE = 200;

// Borra cuentas que nunca confirmaron el correo (código de 6 dígitos vencido
// y jamás ingresado) despues de UNCONFIRMED_TTL_HOURS -- sin esto, un correo
// falso o abandonado deja basura para siempre en auth.users. Cascada limpia
// (public.users.id references auth.users(id) on delete cascade) porque una
// cuenta sin confirmar nunca llegó a crear vehículos/negocios (login
// bloqueado hasta confirmar). Corre diario, mismo patrón que
// check-subscription-expiry (ver migración de cron).
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cutoff = Date.now() - UNCONFIRMED_TTL_HOURS * 60 * 60 * 1000;

  let deleted = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    for (const user of data.users) {
      if (!user.email_confirmed_at && new Date(user.created_at).getTime() < cutoff) {
        const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
        if (!delError) deleted++;
      }
    }

    if (data.users.length < PAGE_SIZE) break;
    page++;
  }

  return new Response(JSON.stringify({ ok: true, deleted }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
