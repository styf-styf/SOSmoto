import { createClient } from './supabase/server';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
}

// Devuelve el admin autenticado, o null si no hay sesión o no es admin.
// Se usa tanto en el layout del dashboard (redirige a /login) como al inicio
// de cada Route Handler privilegiado (responde 401) -- nunca se confía en el
// rol leído del lado del cliente.
export async function requireAdmin(): Promise<AdminUser | null> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user) return null;

  const { data: userRow } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', sessionData.user.id)
    .maybeSingle();

  if (!userRow || userRow.role !== 'admin') return null;

  return { id: userRow.id, email: userRow.email, fullName: userRow.full_name };
}
