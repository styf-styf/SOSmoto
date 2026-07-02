import { supabase } from './supabase';
import { getBusinessById } from './businesses';
import { notifyUser } from './notifications';
import type { Message } from '../types/database';

export async function getMessages(clientId: string, businessId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Message[];
}

export interface SendMessageParams {
  clientId: string;
  businessId: string;
  senderId: string;
  body: string;
}

export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      client_id: params.clientId,
      business_id: params.businessId,
      sender_id: params.senderId,
      body: params.body,
    })
    .select()
    .single();

  if (error) throw error;

  const message = data as Message;
  if (message.sender_id === message.client_id) {
    const business = await getBusinessById(message.business_id);
    if (business) {
      await notifyUser(business.owner_id, 'Nuevo mensaje', 'Tienes un mensaje nuevo', {
        type: 'message',
        businessId: message.business_id,
      });
    }
  } else {
    await notifyUser(message.client_id, 'Nuevo mensaje', 'Tienes un mensaje nuevo', {
      type: 'message',
      businessId: message.business_id,
    });
  }

  return message;
}

export function subscribeToMessages(
  filterColumn: 'client_id' | 'business_id',
  filterValue: string,
  onInsert: (message: Message) => void
) {
  const channel = supabase
    .channel(`messages_${filterColumn}_${filterValue}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `${filterColumn}=eq.${filterValue}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Para el punto rojo de "no leído": reacciona a inserts (mensaje nuevo) y
// updates (alguien lo marcó como leído), sin necesitar el contenido del mensaje.
export function subscribeToThreadChanges(
  filterColumn: 'client_id' | 'business_id',
  filterValue: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`messages_changes_${filterColumn}_${filterValue}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `${filterColumn}=eq.${filterValue}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function hasUnreadMessagesForClient(clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('client_id', clientId)
    .is('read_at', null)
    .neq('sender_id', clientId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function hasUnreadMessagesForBusiness(businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id, client_id')
    .eq('business_id', businessId)
    .is('read_at', null)
    .limit(50);
  if (error) throw error;
  return (data ?? []).some((row) => row.sender_id === row.client_id);
}

export async function markThreadRead(clientId: string, businessId: string, readerId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .is('read_at', null)
    .neq('sender_id', readerId);
  if (error) throw error;
}

export interface ConversationSummary {
  otherId: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  lastReadAt: string | null;
}

export async function getClientConversations(clientId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('business_id, body, created_at, sender_id, read_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return dedupeByOtherId(
    (data ?? []).map((row) => ({
      otherId: row.business_id,
      body: row.body,
      created_at: row.created_at,
      sender_id: row.sender_id,
      read_at: row.read_at,
    }))
  );
}

export async function getBusinessConversations(businessId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('client_id, body, created_at, sender_id, read_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return dedupeByOtherId(
    (data ?? []).map((row) => ({
      otherId: row.client_id,
      body: row.body,
      created_at: row.created_at,
      sender_id: row.sender_id,
      read_at: row.read_at,
    }))
  );
}

function dedupeByOtherId(
  rows: { otherId: string; body: string; created_at: string; sender_id: string; read_at: string | null }[]
): ConversationSummary[] {
  const seen = new Set<string>();
  const summaries: ConversationSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.otherId)) continue;
    seen.add(row.otherId);
    summaries.push({
      otherId: row.otherId,
      lastMessage: row.body,
      lastMessageAt: row.created_at,
      lastSenderId: row.sender_id,
      lastReadAt: row.read_at,
    });
  }
  return summaries;
}
