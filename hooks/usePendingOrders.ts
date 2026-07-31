import { useCallback, useEffect, useState } from 'react';
import { getMyWorkBusiness } from '../services/businesses';
import { hasPendingProductIntents, subscribeToBusinessProductIntents } from '../services/productIntents';
import type { UserRole } from '../types/database';

// Punto rojo del tab "Pedidos" (barra inferior del negocio) -- mismo patrón
// que useUnreadMessages, pero para apartados de producto en estado
// 'pending' de cualquier cliente (no de mensajes).
export function usePendingOrders(profile: { id: string; role: UserRole } | null | undefined) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'business') {
      setBusinessId(null);
      return;
    }
    getMyWorkBusiness(profile.id)
      .then((work) => setBusinessId(work?.business.id ?? null))
      .catch((err) => console.error('load business for pending orders badge error', err));
  }, [profile]);

  const load = useCallback(async () => {
    if (!businessId) {
      setHasPending(false);
      return;
    }
    setHasPending(await hasPendingProductIntents(businessId));
  }, [businessId]);

  useEffect(() => {
    load().catch((err) => console.error('load pending orders error', err));
  }, [load]);

  useEffect(() => {
    if (!businessId) return;
    return subscribeToBusinessProductIntents(businessId, () => {
      load().catch((err) => console.error('reload pending orders error', err));
    });
  }, [businessId, load]);

  return hasPending;
}
