import { supabase } from './supabase';
import { getBusinessOwnerForNotify } from './businesses';
import { notifyUser } from './notifications';
import { subscribeToTable } from './realtime';
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
  imageUrl?: string;
}

export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      client_id: params.clientId,
      business_id: params.businessId,
      sender_id: params.senderId,
      body: params.body,
      image_url: params.imageUrl ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const message = data as Message;
  if (message.sender_id === message.client_id) {
    const ownerId = await getBusinessOwnerForNotify(message.business_id);
    if (ownerId) {
      await notifyUser(
        ownerId,
        'Nuevo mensaje',
        'Tienes un mensaje nuevo',
        { type: 'message', businessId: message.business_id, clientId: message.client_id },
        'mensajes'
      );
    }
  } else {
    await notifyUser(
      message.client_id,
      'Nuevo mensaje',
      'Tienes un mensaje nuevo',
      { type: 'message', businessId: message.business_id },
      'mensajes'
    );
  }

  return message;
}

export function subscribeToMessages(
  filterColumn: 'client_id' | 'business_id',
  filterValue: string,
  onInsert: (message: Message) => void
) {
  return subscribeToTable<Message>(
    `messages_${filterColumn}_${filterValue}`,
    'messages',
    'INSERT',
    `${filterColumn}=eq.${filterValue}`,
    (payload) => onInsert(payload.new as Message)
  );
}

// Para el punto rojo de "no leído": reacciona a inserts (mensaje nuevo) y
// updates (alguien lo marcó como leído), sin necesitar el contenido del mensaje.
export function subscribeToThreadChanges(
  filterColumn: 'client_id' | 'business_id',
  filterValue: string,
  onChange: () => void
) {
  return subscribeToTable(
    `messages_changes_${filterColumn}_${filterValue}`,
    'messages',
    '*',
    `${filterColumn}=eq.${filterValue}`,
    onChange
  );
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

// "Eliminar chat" -- mismo comportamiento que WhatsApp: desaparece solo de
// MI lista, el otro lado conserva su historial intacto, y vuelve a
// aparecer si llega un mensaje nuevo después de ocultarlo (ver migración
// 0163). No borra ningún mensaje real.
export async function hideChat(clientId: string, businessId: string, hiddenBy: 'client' | 'business'): Promise<void> {
  const { error } = await supabase
    .from('hidden_chats')
    .upsert(
      { client_id: clientId, business_id: businessId, hidden_by: hiddenBy, hidden_at: new Date().toISOString() },
      { onConflict: 'client_id,business_id,hidden_by' }
    );
  if (error) throw error;
}

async function getHiddenAtMap(hiddenBy: 'client' | 'business'): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('hidden_chats').select('client_id, business_id, hidden_at').eq('hidden_by', hiddenBy);
  if (error) throw error;
  const key = hiddenBy === 'client' ? 'business_id' : 'client_id';
  return new Map((data ?? []).map((row) => [(row as any)[key] as string, row.hidden_at as string]));
}

export async function getClientConversations(clientId: string): Promise<ConversationSummary[]> {
  const [{ data, error }, hiddenAtByOtherId] = await Promise.all([
    supabase
      .from('messages')
      .select('business_id, body, image_url, created_at, sender_id, read_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    getHiddenAtMap('client'),
  ]);
  if (error) throw error;

  return dedupeByOtherId(
    (data ?? []).map((row) => ({
      otherId: row.business_id,
      body: row.body || (row.image_url ? '[Imagen]' : ''),
      created_at: row.created_at,
      sender_id: row.sender_id,
      read_at: row.read_at,
    })),
    hiddenAtByOtherId
  );
}

export async function getBusinessConversations(businessId: string): Promise<ConversationSummary[]> {
  const [{ data, error }, hiddenAtByOtherId] = await Promise.all([
    supabase
      .from('messages')
      .select('client_id, body, image_url, created_at, sender_id, read_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    getHiddenAtMap('business'),
  ]);
  if (error) throw error;

  return dedupeByOtherId(
    (data ?? []).map((row) => ({
      otherId: row.client_id,
      body: row.body || (row.image_url ? '[Imagen]' : ''),
      created_at: row.created_at,
      sender_id: row.sender_id,
      read_at: row.read_at,
    })),
    hiddenAtByOtherId
  );
}

function dedupeByOtherId(
  rows: { otherId: string; body: string; created_at: string; sender_id: string; read_at: string | null }[],
  hiddenAtByOtherId: Map<string, string>
): ConversationSummary[] {
  const seen = new Set<string>();
  const summaries: ConversationSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.otherId)) continue;
    seen.add(row.otherId);
    // Ordenado desc, así que esta es la fila del último mensaje del hilo --
    // si se ocultó DESPUÉS de ese último mensaje, se queda oculto; si llegó
    // un mensaje nuevo luego de ocultarlo, vuelve a aparecer solo.
    const hiddenAt = hiddenAtByOtherId.get(row.otherId);
    if (hiddenAt && hiddenAt >= row.created_at) continue;
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
