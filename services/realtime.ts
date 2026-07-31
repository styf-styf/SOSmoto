import { supabase } from './supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Boilerplate mecánico repetido en 13 funciones subscribeToX distintas
// (appointments.ts, appointmentRequests.ts, messages.ts, productIntents.ts,
// serviceIntents.ts, helpRequests.ts): armar un channel con nombre único,
// suscribirse a postgres_changes, y devolver el cleanup de removeChannel.
// Cada subscribeToX conserva su propia lógica de filtrado/transformación en
// el callback -- esto solo evita repetir el canal/on/subscribe/cleanup.
export function subscribeToTable<T extends object = Record<string, unknown>>(
  channelPrefix: string,
  table: string,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE',
  filter: string,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void
): () => void {
  const channel = supabase
    .channel(`${channelPrefix}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event, schema: 'public', table, filter } as any,
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
