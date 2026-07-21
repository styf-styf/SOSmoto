import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getActiveHelpRequest,
  getHelpRequestById,
  subscribeToHelpRequest,
} from '../services/helpRequests';
import type { HelpRequest } from '../types/database';

export function useActiveHelpRequest(clientId: string | undefined) {
  const [activeRequest, setActiveRequest] = useState<HelpRequest | null>(null);
  const [completedRequest, setCompletedRequest] = useState<HelpRequest | null>(
    null,
  );
  // El cliente cancelando su propia solicitud ya limpia activeRequest de
  // forma directa (ver auxilio.tsx) -- este flag evita que el realtime de
  // esa misma cancelación dispare también el aviso de "se cerró sola".
  const selfClosedRef = useRef(false);
  const [externallyClosedNotice, setExternallyClosedNotice] = useState<
    string | null
  >(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setActiveRequest(null);
      return;
    }
    const request = await getActiveHelpRequest(clientId);
    setActiveRequest(request);
  }, [clientId]);

  useEffect(() => {
    load().catch((err) => console.error('load active help request error', err));
  }, [load]);

  const checkCompletionAndReload = useCallback(
    (requestId: string) => {
      // getActiveHelpRequest deja de devolver la solicitud en cuanto pasa a
      // 'completed', así que hay que leerla por id antes de recargar para
      // poder mostrarle al cliente el prompt de calificación.
      return getHelpRequestById(requestId)
        .then((updated) => {
          if (updated?.status === 'completed') {
            setCompletedRequest(updated);
          } else if (updated?.status === 'cancelled') {
            // Si el cliente la canceló él mismo, auxilio.tsx ya llamó a
            // markSelfClosed() antes -- no hace falta avisarle de algo que
            // acaba de hacer. Cualquier otro cierre a 'cancelled' (hoy solo
            // ocurre si un admin lo hiciera desde el panel -- ver
            // admin/app/api/auxilio/[id]/route.ts, que de momento no toca
            // status) sí lo hizo alguien más, así que se explica.
            if (selfClosedRef.current) {
              selfClosedRef.current = false;
            } else {
              setExternallyClosedNotice(
                'Tu solicitud de auxilio se cerró y ya no sigue activa. Si todavía necesitas ayuda, pide un nuevo auxilio.',
              );
            }
          }
        })
        .catch((err) =>
          console.error('check completed help request error', err),
        )
        .finally(() => load());
    },
    [load],
  );

  useEffect(() => {
    if (!activeRequest) return;
    const requestId = activeRequest.id;
    const unsubscribe = subscribeToHelpRequest(requestId, () => {
      checkCompletionAndReload(requestId);
    });
    return unsubscribe;
  }, [activeRequest?.id, checkCompletionAndReload]);

  const refresh = useCallback(async () => {
    if (activeRequest) {
      await checkCompletionAndReload(activeRequest.id);
    } else {
      await load();
    }
  }, [activeRequest, checkCompletionAndReload, load]);

  return {
    activeRequest,
    setActiveRequest,
    completedRequest,
    clearCompletedRequest: () => setCompletedRequest(null),
    refresh,
    externallyClosedNotice,
    clearExternallyClosedNotice: () => setExternallyClosedNotice(null),
    markSelfClosed: () => {
      selfClosedRef.current = true;
    },
  };
}
