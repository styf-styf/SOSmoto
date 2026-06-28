import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getMyWorkBusiness } from '../services/businesses';

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

  useEffect(() => {
    if (!profile) {
      setState({ isLimited: false, reason: null });
      return;
    }
    if (profile.role !== 'business') {
      setState({ isLimited: profile.is_limited, reason: profile.limitation_reason });
      return;
    }
    getMyWorkBusiness(profile.id)
      .then((work) => {
        setState({
          isLimited: work?.business.is_limited ?? false,
          reason: work?.business.limitation_reason ?? null,
        });
      })
      .catch((err) => console.error('useAccountLimited business error', err));
  }, [profile?.id, profile?.role, profile?.is_limited, profile?.limitation_reason]);

  return state;
}
