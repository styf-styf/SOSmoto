import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente con service role -- bypassa RLS. Solo se debe usar dentro de Route
// Handlers, después de verificar la sesión y el rol admin con requireAdmin().
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
