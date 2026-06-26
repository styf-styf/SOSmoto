import { useCallback, useEffect, useState } from 'react';
import { getActiveHelpRequest, subscribeToHelpRequest } from '../services/helpRequests';
import type { HelpRequest } from '../types/database';

export function useActiveHelpRequest(clientId: string | undefined) {
  const [activeRequest, setActiveRequest] = useState<HelpRequest | null>(null);

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

  useEffect(() => {
    if (!activeRequest) return;
    const unsubscribe = subscribeToHelpRequest(activeRequest.id, load);
    return unsubscribe;
  }, [activeRequest?.id, load]);

  return { activeRequest, setActiveRequest, refresh: load };
}
