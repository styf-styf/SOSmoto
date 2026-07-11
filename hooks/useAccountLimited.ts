import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getMyWorkBusiness } from '../services/businesses';
import { supabase } from '../services/supabase';

export interface AccountLimitedState {
  isLimited: boolean;
  reason: string | null;
}

// Resuelve si la cuenta actual está limitada sin importar el rol: para un
// cliente es su propio profile.is_limited; para un negocio es el is_limited
// de SU negocio (el flag is_limited del propio usuario dueño es inerte --
// ver migración 0039/0040, las restricciones de negocio siempre se chequean
// contra `businesses.is_limited`, nunca contra `users.is_limited`).
export function useAccountLimited(): AccountLimitedState {
  const { profile } = useAuth();
  const [state, setState] = useState<AccountLimitedState>({ isLimited: false, reason: null });
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setState({ isLimited: false, reason: null });
      setBusinessId(null);
      return;
    }
    if (profile.role !== 'business') {
      setState({ isLimited: profile.is_limited, reason: profile.limitation_reason });
      setBusinessId(null);
      return;
    }
    getMyWorkBusiness(profile.id)
      .then((work) => {
        setBusinessId(work?.business.id ?? null);
        setState({
          isLimited: work?.business.is_limited ?? false,
          reason: work?.business.limitation_reason ?? null,
        });
      })
      .catch((err) => console.error('useAccountLimited business error', err));
  }, [profile?.id, profile?.role, profile?.is_limited, profile?.limitation_reason]);

  // Sin esto, si el admin limita o desbloquea el negocio mientras el usuario
  // ya tiene una pantalla abierta (ej. comentando un post), el estado quedaba
  // desactualizado hasta que algo más disparara el efecto de arriba.
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`account_limited_business_${businessId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` },
        (payload) => {
          const row = payload.new as { is_limited: boolean; limitation_reason: string | null };
          setState({ isLimited: row.is_limited, reason: row.limitation_reason });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  return state;
}
