import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/resend.ts';

// Cron diario: finaliza las solicitudes de eliminación de cuenta cuyo plazo
// de gracia de 30 días ya venció (ver migración 0146 y
// services/accountDeletion.ts). No hace un DELETE real -- eso arrastraría
// en cascada (FK on delete cascade) los pagos/facturación del negocio, que
// sosmoto.net/eliminar-cuenta promete conservar por obligación legal. En
// cambio: anonimiza los datos personales y bloquea el login para siempre.
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: dueRequests, error } = await supabase
    .from('account_deletion_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString());
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let completed = 0;

  for (const request of dueRequests ?? []) {
    const { data: user } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', request.user_id)
      .maybeSingle();

    // Bloquea el login para siempre -- no se borra el usuario de auth.users
    // (eso cascadearía y borraría public.users -> businesses -> payments,
    // ver comentario de arriba).
    const { error: banError } = await supabase.auth.admin.updateUserById(request.user_id, {
      ban_duration: '876000h', // ~100 años, forma documentada de Supabase de "para siempre"
    });
    if (banError) {
      console.error('ban user error', request.user_id, banError);
      continue;
    }

    await supabase
      .from('users')
      .update({
        full_name: 'Usuario eliminado',
        phone: null,
        avatar_url: null,
        push_token: null,
        notification_prefs: {},
      })
      .eq('id', request.user_id);

    // Negocios del usuario (si es dueño) quedan desactivados -- mismo
    // mecanismo que "Desactivar negocio temporalmente" (businesses.is_deactivated),
    // no un borrado -- conserva catálogo/reseñas/pagos históricos.
    await supabase
      .from('businesses')
      .update({ is_deactivated: true })
      .eq('owner_id', request.user_id);

    await supabase
      .from('account_deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (user?.email) {
      await sendEmail(
        user.email,
        'Tu cuenta de SOSmoto fue eliminada',
        `<h2>Cuenta eliminada</h2>
<p>Hola ${user.full_name ?? ''},</p>
<p>Como pediste, tu cuenta de SOSmoto ya fue eliminada. Si fue un error, contáctanos a soporte@sosmoto.net.</p>`
      );
    }

    completed++;
  }

  return new Response(JSON.stringify({ ok: true, completed }), { headers: { 'Content-Type': 'application/json' } });
});
