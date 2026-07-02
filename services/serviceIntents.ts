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
  }

  return data as ServiceIntent;
}

export async function cancelServiceIntent(intentId: string): Promise<void> {
  const { error } = await supabase
    .from('service_intents')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;
}

export async function updateServiceIntentStatus(
  intentId: string,
  status: ServiceIntentStatus
): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('service_intents')
    .select('client_id, service_id')
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
    await notifyUser(intent.client_id, title, body, { type: 'service_intent', serviceId: intent.service_id });
  }
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
  onUpdate: (intent: ServiceIntent | null) => void
) {
  const channel = supabase
    .channel(`service_intent_${clientId}_${serviceId}`)
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
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
