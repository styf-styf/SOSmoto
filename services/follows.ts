import { supabase } from './supabase';

// followerBusinessId presente = el que sigue es un negocio (taller/tienda
// siguiendo a otra tienda, relación B2B) -- el follow es compartido por
// todo su equipo, no de la persona que tocó el botón. Ausente/null = follow
// normal de cliente, sigue siendo por clientId.
export async function isFollowing(
  clientId: string,
  businessId: string,
  followerBusinessId?: string | null,
): Promise<boolean> {
  let query = supabase.from('follows').select('id').eq('business_id', businessId);
  query = followerBusinessId
    ? query.eq('follower_business_id', followerBusinessId)
    : query.eq('client_id', clientId).is('follower_business_id', null);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function followBusiness(clientId: string, businessId: string, followerBusinessId?: string | null) {
  const { error } = await supabase
    .from('follows')
    .insert({ client_id: clientId, business_id: businessId, follower_business_id: followerBusinessId ?? null });

  if (error) throw error;
}

export async function unfollowBusiness(clientId: string, businessId: string, followerBusinessId?: string | null) {
  let query = supabase.from('follows').delete().eq('business_id', businessId);
  query = followerBusinessId
    ? query.eq('follower_business_id', followerBusinessId)
    : query.eq('client_id', clientId).is('follower_business_id', null);

  const { error } = await query;
  if (error) throw error;
}

export async function getFollowsCount(clientId: string, followerBusinessId?: string | null): Promise<number> {
  let query = supabase.from('follows').select('id', { count: 'exact', head: true });
  query = followerBusinessId
    ? query.eq('follower_business_id', followerBusinessId)
    : query.eq('client_id', clientId).is('follower_business_id', null);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
