import { supabase } from './supabase';
import { distanceKm } from '../utils/distance';
import { notifyUser } from './notifications';
import type { Business, HelpRequest, HelpRequestNotification } from '../types/database';

async function findNearbyWorkshops(latitude: number, longitude: number): Promise<Business[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('business_type', 'workshop')
    .not('aid_radius_km', 'is', null);
  if (error) throw error;

  return ((data ?? []) as Business[]).filter(
    (b) => distanceKm(latitude, longitude, b.latitude, b.longitude) <= (b.aid_radius_km ?? 0)
  );
}

export async function getNearbyWorkshops(latitude: number, longitude: number): Promise<Business[]> {
  return findNearbyWorkshops(latitude, longitude);
}

export async function updateHelpRequestBusinessLocation(
  id: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const { error } = await supabase
    .from('help_requests')
    .update({
      business_latitude: latitude,
      business_longitude: longitude,
      business_location_updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export interface CreateHelpRequestParams {
  clientId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export async function createHelpRequest(params: CreateHelpRequestParams): Promise<HelpRequest> {
  const { data: helpRequest, error } = await supabase
    .from('help_requests')
    .insert({
      client_id: params.clientId,
      vehicle_id: params.vehicleId,
      latitude: params.latitude,
      longitude: params.longitude,
      description: params.description ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const nearbyWorkshops = await findNearbyWorkshops(params.latitude, params.longitude);
  if (nearbyWorkshops.length > 0) {
    const { error: notifyError } = await supabase.from('help_request_notifications').insert(
      nearbyWorkshops.map((b) => ({ help_request_id: helpRequest.id, business_id: b.id }))
    );
    if (notifyError) throw notifyError;

    await Promise.all(
      nearbyWorkshops.map((b) =>
        notifyUser(b.owner_id, 'Nueva solicitud de auxilio', 'Un motociclista cerca de ti necesita ayuda.', {
          type: 'help_request',
          helpRequestId: helpRequest.id,
        })
      )
    );
  }

  return helpRequest as HelpRequest;
}

export async function getActiveHelpRequest(clientId: string): Promise<HelpRequest | null> {
  const { data, error } = await supabase
    .from('help_requests')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HelpRequest | null;
}

export async function cancelHelpRequest(id: string): Promise<void> {
  const { error } = await supabase.from('help_requests').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

export function subscribeToHelpRequest(id: string, onChange: () => void) {
  // Nombre único por suscripción: si dos componentes se suscriben al mismo id a la vez,
  // supabase-js reutiliza el canal existente por nombre y falla al volver a llamar .on() tras subscribe().
  const channel = supabase
    .channel(`help_request_${id}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'help_requests', filter: `id=eq.${id}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToBusinessRequests(businessId: string, onChange: () => void) {
  const channel = supabase
    .channel(`business_requests_${businessId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'help_request_notifications', filter: `business_id=eq.${businessId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export interface PendingHelpRequest {
  notification: HelpRequestNotification;
  helpRequest: HelpRequest;
  client: { id: string; full_name: string; phone: string | null } | null;
}

export async function getPendingRequests(businessId: string): Promise<PendingHelpRequest[]> {
  const { data: notifications, error } = await supabase
    .from('help_request_notifications')
    .select('*')
    .eq('business_id', businessId)
    .eq('responded', false)
    .order('notified_at', { ascending: false });
  if (error) throw error;

  const notificationList = (notifications ?? []) as HelpRequestNotification[];
  if (notificationList.length === 0) return [];

  const helpRequestIds = notificationList.map((n) => n.help_request_id);
  const { data: helpRequests, error: hrError } = await supabase
    .from('help_requests')
    .select('*')
    .in('id', helpRequestIds)
    .eq('status', 'pending');
  if (hrError) throw hrError;

  const helpRequestList = (helpRequests ?? []) as HelpRequest[];
  const clientIds = Array.from(new Set(helpRequestList.map((hr) => hr.client_id)));

  const { data: clients, error: clientsError } = clientIds.length
    ? await supabase.from('users').select('id, full_name, phone').in('id', clientIds)
    : { data: [], error: null };
  if (clientsError) throw clientsError;

  const helpRequestById = new Map(helpRequestList.map((hr) => [hr.id, hr]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  return notificationList
    .map((notification) => {
      const helpRequest = helpRequestById.get(notification.help_request_id);
      if (!helpRequest) return null;
      return {
        notification,
        helpRequest,
        client: clientById.get(helpRequest.client_id) ?? null,
      };
    })
    .filter((item): item is PendingHelpRequest => item !== null);
}

export interface AcceptHelpRequestParams {
  helpRequestId: string;
  businessId: string;
  estimatedArrivalMinutes: number;
}

export async function acceptHelpRequest(params: AcceptHelpRequestParams): Promise<void> {
  const { data, error } = await supabase
    .from('help_requests')
    .update({
      status: 'accepted',
      accepted_business_id: params.businessId,
      estimated_arrival_minutes: params.estimatedArrivalMinutes,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', params.helpRequestId)
    .eq('status', 'pending')
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Esta solicitud ya fue aceptada por otro taller.');
  }

  await supabase
    .from('help_request_notifications')
    .update({ responded: true })
    .eq('help_request_id', params.helpRequestId)
    .eq('business_id', params.businessId);

  const acceptedRequest = data[0] as HelpRequest;
  await notifyUser(
    acceptedRequest.client_id,
    'Un taller va en camino',
    `Llega en ~${params.estimatedArrivalMinutes} minutos.`,
    { type: 'help_request_accepted', helpRequestId: acceptedRequest.id }
  );
}

export async function rejectHelpRequest(helpRequestId: string, businessId: string): Promise<void> {
  const { error } = await supabase
    .from('help_request_notifications')
    .update({ responded: true })
    .eq('help_request_id', helpRequestId)
    .eq('business_id', businessId);
  if (error) throw error;
}

export async function completeHelpRequest(helpRequestId: string): Promise<void> {
  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', helpRequestId);
  if (error) throw error;
}

export async function getActiveBusinessRequest(businessId: string): Promise<HelpRequest | null> {
  const { data, error } = await supabase
    .from('help_requests')
    .select('*')
    .eq('accepted_business_id', businessId)
    .in('status', ['accepted', 'in_progress'])
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HelpRequest | null;
}
