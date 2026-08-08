import { useCallback, useEffect, useState } from 'react';
import { getMyWorkBusiness } from '../services/businesses';
import { getActiveBusinessRequest, subscribeToBusinessRequests, subscribeToHelpRequest } from '../services/helpRequests';
import type { UserRole } from '../types/database';

// Punto rojo del tab "Solicitudes" (barra inferior del negocio) -- mismo
// patrón que usePendingOrders/useUnreadMessages, para cuando este negocio
// tiene un auxilio activo (aceptado/en camino) en curso, igual que el punto
// que ya ve el cliente en su pestaña SOS (useActiveHelpRequest).
export function useActiveBusinessHelpRequest(profile: { id: string; role: UserRole } | null | undefined) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'business') {
      setBusinessId(null);
      return;
    }
    getMyWorkBusiness(profile.id)
      .then((work) => setBusinessId(work?.business.id ?? null))
      .catch((err) => console.error('load business for active help request badge error', err));
  }, [profile]);

  const load = useCallback(async () => {
    if (!businessId) {
      setActiveId(null);
      return;
    }
    const active = await getActiveBusinessRequest(businessId);
    setActiveId(active?.id ?? null);
  }, [businessId]);

  useEffect(() => {
    load().catch((err) => console.error('load active help request badge error', err));
  }, [load]);

  useEffect(() => {
    if (!businessId) return;
    return subscribeToBusinessRequests(businessId, () => {
      load().catch((err) => console.error('reload active help request badge error', err));
    });
  }, [businessId, load]);

  useEffect(() => {
    // subscribeToBusinessRequests solo escucha help_request_notifications --
    // si el cliente cancela o el auxilio se completa, eso actualiza
    // help_requests directamente y esa tabla no cambia (mismo motivo que en
    // app/(business)/(tabs)/solicitudes.tsx), así que sin esto el punto se
    // quedaría prendido después de que el auxilio ya terminó.
    if (!activeId) return;
    return subscribeToHelpRequest(activeId, () => {
      load().catch((err) => console.error('reload active help request badge error', err));
    });
  }, [activeId, load]);

  return !!activeId;
}
