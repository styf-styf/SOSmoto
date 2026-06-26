import { useCallback, useEffect, useState } from 'react';
import { getMyWorkBusiness } from '../services/businesses';
import { hasUnreadMessagesForBusiness, hasUnreadMessagesForClient, subscribeToThreadChanges } from '../services/messages';
import type { UserRole } from '../types/database';

export function useUnreadMessages(profile: { id: string; role: UserRole } | null | undefined) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'business') {
      setBusinessId(null);
      return;
    }
    getMyWorkBusiness(profile.id)
      .then((work) => setBusinessId(work?.business.id ?? null))
      .catch((err) => console.error('load business for unread badge error', err));
  }, [profile]);

  const load = useCallback(async () => {
    if (!profile) {
      setHasUnread(false);
      return;
    }
    if (profile.role === 'client') {
      setHasUnread(await hasUnreadMessagesForClient(profile.id));
    } else if (businessId) {
      setHasUnread(await hasUnreadMessagesForBusiness(businessId));
    }
  }, [profile, businessId]);

  useEffect(() => {
    load().catch((err) => console.error('load unread messages error', err));
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    const filterColumn = profile.role === 'client' ? 'client_id' : 'business_id';
    const filterValue = profile.role === 'client' ? profile.id : businessId;
    if (!filterValue) return;
    const unsubscribe = subscribeToThreadChanges(filterColumn, filterValue, () => {
      load().catch((err) => console.error('reload unread messages error', err));
    });
    return unsubscribe;
  }, [profile, businessId, load]);

  return hasUnread;
}
