import { supabase } from './supabase';
import { notifyUser } from './notifications';

// El combo "notifyUser + dejar rastro en messages" se repetía función por
// función en productIntents.ts y serviceIntents.ts (create/cancel/update
// status), con dos variantes según quién dispara el evento:
// - notifyAndLogClientEvent: el cliente hace algo (apartar/agendar/cancelar)
//   -- sender_id del mensaje es el propio cliente.
// - notifyAndLogBusinessEvent: el negocio confirma/rechaza/marca vendido --
//   sender_id debe ser quien está autenticado ahora mismo (RLS de messages
//   exige sender_id = auth.uid()), puede ser el dueño o un empleado.

export async function notifyAndLogClientEvent(params: {
  // null/undefined si no se encontró el dueño del negocio (dato faltante) --
  // el mensaje en el chat igual se deja, solo se salta el push.
  notifyUserId: string | null | undefined;
  title: string;
  body: string;
  data: Record<string, unknown>;
  clientId: string;
  businessId: string;
  messageBody: string;
}): Promise<void> {
  if (params.notifyUserId) {
    await notifyUser(params.notifyUserId, params.title, params.body, params.data);
  }
  await supabase.from('messages').insert({
    client_id: params.clientId,
    business_id: params.businessId,
    sender_id: params.clientId,
    body: params.messageBody,
  });
}

export async function notifyAndLogBusinessEvent(params: {
  clientId: string;
  businessId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  messageBody: string;
}): Promise<void> {
  await notifyUser(params.clientId, params.title, params.body, params.data);
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('messages').insert({
      client_id: params.clientId,
      business_id: params.businessId,
      sender_id: authData.user.id,
      body: params.messageBody,
    });
  }
}
