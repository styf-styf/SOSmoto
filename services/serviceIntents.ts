import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { ServiceIntent, ServiceIntentWithService, ServiceIntentStatus } from '../types/database';

export async function getClientIntentForService(
  clientId: string,
  serviceId: string
): Promise<ServiceIntent | null> {
  const { data, error } = await supabase
    .from('service_intents')
    .select('*')
    .eq('client_id', clientId)
    .eq('service_id', serviceId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceIntent | null;
}

export async function createServiceIntent(
  clientId: string,
  serviceId: string,
  businessId: string
): Promise<ServiceIntent> {
  const { data, error } = await supabase
    .from('service_intents')
    .insert({ client_id: clientId, service_id: serviceId, business_id: businessId })
    .select()
    .single();
  if (error) throw error;

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .maybeSingle();
  const { data: service } = await supabase
    .from('services')
    .select('name')
    .eq('id', serviceId)
    .maybeSingle();
  if (business?.owner_id && service?.name) {
    await notifyUser(
      business.owner_id,
      'Servicio agendado',
      `Un cliente quiere agendar: ${service.name}`,
      { type: 'service_intent', serviceId, businessId }
    );
    // Mismo patrón que appointmentRequests.ts (createAppointmentRequest) --
    // deja un rastro permanente en el historial del chat, a diferencia del
    // banner en vivo que desaparece en cuanto el intent se resuelve.
    await supabase.from('messages').insert({
      client_id: clientId,
      business_id: businessId,
      sender_id: clientId,
      body: `🔧 Quiere agendar: ${service.name}`,
    });
  }

  return data as ServiceIntent;
}

export async function cancelServiceIntent(intentId: string): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('service_intents')
    .select('client_id, service_id, business_id')
    .eq('id', intentId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('service_intents')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;

  if (intent) {
    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', intent.business_id)
      .maybeSingle();
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', intent.service_id)
      .maybeSingle();
    const serviceName = service?.name ?? 'un servicio';

    if (business?.owner_id) {
      await notifyUser(
        business.owner_id,
        'Solicitud de servicio cancelada',
        `El cliente canceló: ${serviceName}`,
        { type: 'service_intent', serviceId: intent.service_id, businessId: intent.business_id }
      );
    }
    await supabase.from('messages').insert({
      client_id: intent.client_id,
      business_id: intent.business_id,
      sender_id: intent.client_id,
      body: `❌ Canceló: ${serviceName}`,
    });
  }
}

export async function updateServiceIntentStatus(
  intentId: string,
  status: ServiceIntentStatus
): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('service_intents')
    .select('client_id, service_id, business_id')
    .eq('id', intentId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('service_intents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;

  if (intent && (status === 'confirmed' || status === 'unavailable')) {
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', intent.service_id)
      .maybeSingle();
    const serviceName = service?.name ?? 'tu servicio';
    const title = status === 'confirmed' ? 'Cita confirmada' : 'Servicio no disponible';
    const body =
      status === 'confirmed'
        ? `Tu cita para "${serviceName}" fue confirmada por el negocio`
        : `El negocio indicó que "${serviceName}" no está disponible en este momento`;
    await notifyUser(intent.client_id, title, body, { type: 'service_intent', serviceId: intent.service_id, businessId: intent.business_id });

    // sender_id debe ser quien está autenticado ahora mismo (RLS de messages
    // exige sender_id = auth.uid()) -- puede ser el dueño o cualquier
    // empleado con permiso, nunca asumir que es el dueño.
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      await supabase.from('messages').insert({
        client_id: intent.client_id,
        business_id: intent.business_id,
        sender_id: authData.user.id,
        body:
          status === 'confirmed'
            ? `✅ Confirmado: ${serviceName}`
            : `⚠️ No disponible: ${serviceName}`,
      });
    }
  }
}

export async function getClientServiceIntents(
  businessId: string,
  clientId: string
): Promise<ServiceIntentWithService[]> {
  const { data, error } = await supabase
    .from('service_intents')
    .select('*, services(name, reference_price)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (ServiceIntent & {
      services: { name: string; reference_price: number | null } | null;
    })[]
  ).map((row) => ({
    ...row,
    service_name: row.services?.name ?? 'Servicio',
    service_price: row.services?.reference_price ?? null,
  }));
}

// Avisa (sin payload propio, el caller vuelve a pedir la lista) cuando cambia
// algún service_intent de este cliente con este negocio -- usado por el
// banner de servicios agendados en el chat (lado cliente). Mismo patrón que
// subscribeToClientProductIntentsForBusiness en productIntents.ts.
export function subscribeToClientServiceIntentsForBusiness(
  clientId: string,
  businessId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`service_intents_biz_${clientId}_${businessId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_intents', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as ServiceIntent;
        if (row.business_id === businessId) onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Lado negocio: avisa con la etiqueta ya armada cuando el cliente cancela un
// servicio agendado pendiente -- alimenta la tarjeta "Cancelado" del chat.
// Mismo patrón que subscribeToProductIntentCancelled en productIntents.ts.
export function subscribeToServiceIntentCancelled(
  businessId: string,
  clientId: string,
  onCancelled: (intentId: string, label: string) => void
) {
  const channel = supabase
    .channel(`service_intent_cancel_${businessId}_${clientId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'service_intents', filter: `business_id=eq.${businessId}` },
      async (payload) => {
        const row = payload.new as ServiceIntent;
        if (row.client_id !== clientId || row.status !== 'cancelled') return;
        const { data: service } = await supabase.from('services').select('name').eq('id', row.service_id).maybeSingle();
        onCancelled(row.id, service?.name ?? 'un servicio');
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getPendingServiceIntentsForBusinessClient(
  businessId: string,
  clientId: string
): Promise<ServiceIntentWithService[]> {
  const { data, error } = await supabase
    .from('service_intents')
    .select('*, services(name, reference_price)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (ServiceIntent & {
      services: { name: string; reference_price: number | null } | null;
    })[]
  ).map((row) => ({
    ...row,
    service_name: row.services?.name ?? 'Servicio',
    service_price: row.services?.reference_price ?? null,
  }));
}

export function subscribeToClientServiceIntent(
  clientId: string,
  serviceId: string,
  onUpdate: (intent: ServiceIntent | null) => void,
  onUnavailable?: () => void
) {
  const channel = supabase
    .channel(`service_intent_${clientId}_${serviceId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'service_intents', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const row = payload.new as ServiceIntent;
        if (row.service_id !== serviceId) return;
        if (row.status === 'confirmed' || row.status === 'pending') {
          onUpdate(row);
        } else {
          onUpdate(null);
          if (row.status === 'unavailable') onUnavailable?.();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
