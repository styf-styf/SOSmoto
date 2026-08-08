import { supabase } from './supabase';
import { distanceKm } from '../utils/distance';
import { getBusinessOwnerForNotify } from './businesses';
import { notifyUser } from './notifications';
import { subscribeToTable } from './realtime';
import type {
  Business,
  HelpRequest,
  HelpRequestNotification,
  VehicleInfo,
} from '../types/database';

const FALLBACK_NEAREST_COUNT = 5;

interface NearbyWorkshopsResult {
  workshops: Business[];
  outOfRange: boolean;
}

async function findNearbyWorkshops(
  latitude: number,
  longitude: number,
): Promise<NearbyWorkshopsResult> {
  const { data, error } = await supabase
    .from('businesses_public')
    .select('*')
    .eq('business_type', 'workshop')
    .eq('is_available_for_aid', true)
    .eq('is_deactivated', false)
    .not('aid_radius_km', 'is', null);
  if (error) throw error;

  const candidates = ((data ?? []) as Business[]).map((b) => ({
    business: b,
    distance: distanceKm(latitude, longitude, b.latitude, b.longitude),
  }));

  const inRange = candidates.filter(
    (c) => c.distance <= (c.business.aid_radius_km ?? 0),
  );
  if (inRange.length > 0) {
    return { workshops: inRange.map((c) => c.business), outOfRange: false };
  }

  // Ningun taller tiene al cliente dentro de su radio configurado -- en vez
  // de dejar la solicitud sin nadie a quien notificar (grave en una
  // emergencia), se notifica igual a los mas cercanos, marcados como fuera
  // de su radio declarado.
  const nearest = candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, FALLBACK_NEAREST_COUNT)
    .map((c) => c.business);
  return { workshops: nearest, outOfRange: true };
}

export async function getNearbyWorkshops(
  latitude: number,
  longitude: number,
): Promise<Business[]> {
  return (await findNearbyWorkshops(latitude, longitude)).workshops;
}

export async function updateHelpRequestBusinessLocation(
  id: string,
  latitude: number,
  longitude: number,
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

// El cron de update-help-request-eta corre cada 2 min -- sin esto, el ETA
// queda en null hasta el siguiente tick apenas el taller acepta/comparte
// ubicación por primera vez. Es "mejor esfuerzo": si falla, el cron lo
// termina calculando igual un poco más tarde.
export async function triggerEtaUpdate(): Promise<void> {
  try {
    await supabase.functions.invoke('update-help-request-eta');
  } catch (err) {
    console.error('trigger eta update error', err);
  }
}

export interface CreateHelpRequestParams {
  clientId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export async function createHelpRequest(
  params: CreateHelpRequestParams,
): Promise<HelpRequest> {
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

  const { workshops: nearbyWorkshops, outOfRange } = await findNearbyWorkshops(
    params.latitude,
    params.longitude,
  );
  if (nearbyWorkshops.length > 0) {
    const { error: notifyError } = await supabase
      .from('help_request_notifications')
      .insert(
        nearbyWorkshops.map((b) => ({
          help_request_id: helpRequest.id,
          business_id: b.id,
          out_of_range: outOfRange,
        })),
      );
    if (notifyError) throw notifyError;

    // owner_id ya no viaja en businesses_public -- se resuelve por negocio
    // justo acá, apoyado en que help_request_notifications (arriba) ya
    // quedó insertado ANTES de este punto, así que can_notify_user ya
    // encuentra la relación recién creada (ver migración 0158).
    await Promise.all(
      nearbyWorkshops.map(async (b) => {
        const ownerId = await getBusinessOwnerForNotify(b.id);
        if (!ownerId) return;
        await notifyUser(
          ownerId,
          'Nueva solicitud de auxilio',
          'Un motociclista cerca de ti necesita ayuda.',
          {
            type: 'help_request',
            helpRequestId: helpRequest.id,
          },
          'auxilio',
        );
      }),
    );
  }

  return helpRequest as HelpRequest;
}

export async function getNotifiedWorkshopsCount(
  helpRequestId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('help_request_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('help_request_id', helpRequestId);
  if (error) throw error;
  return count ?? 0;
}

export async function wasNotifiedOutOfRange(
  helpRequestId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('help_request_notifications')
    .select('out_of_range')
    .eq('help_request_id', helpRequestId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.out_of_range ?? false;
}

export async function getActiveHelpRequest(
  clientId: string,
): Promise<HelpRequest | null> {
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
  const { data, error } = await supabase
    .from('help_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;

  const request = data as HelpRequest | null;
  if (!request?.accepted_business_id) return;

  const ownerId = await getBusinessOwnerForNotify(request.accepted_business_id);
  if (!ownerId) return;

  await notifyUser(
    ownerId,
    'El cliente canceló el auxilio',
    'El cliente canceló la solicitud de auxilio que estabas atendiendo.',
    { type: 'help_request_cancelled_by_client', helpRequestId: id },
    'auxilio',
  );
}

export async function getHelpRequestById(
  id: string,
): Promise<HelpRequest | null> {
  const { data, error } = await supabase
    .from('help_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as HelpRequest | null;
}

export function subscribeToHelpRequest(id: string, onChange: () => void) {
  // Nombre único por suscripción: si dos componentes se suscriben al mismo id a la vez,
  // supabase-js reutiliza el canal existente por nombre y falla al volver a llamar .on() tras subscribe().
  return subscribeToTable(`help_request_${id}`, 'help_requests', '*', `id=eq.${id}`, onChange);
}

export function subscribeToBusinessRequests(
  businessId: string,
  onChange: () => void,
) {
  return subscribeToTable(
    `business_requests_${businessId}`,
    'help_request_notifications',
    '*',
    `business_id=eq.${businessId}`,
    onChange,
  );
}

export interface PendingHelpRequest {
  notification: HelpRequestNotification;
  helpRequest: HelpRequest;
  client: { id: string; full_name: string; phone: string | null; avatar_url: string | null } | null;
  vehicle: VehicleInfo | null;
}

export async function getPendingRequests(
  businessId: string,
): Promise<PendingHelpRequest[]> {
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
  const clientIds = Array.from(
    new Set(helpRequestList.map((hr) => hr.client_id)),
  );
  const vehicleIds = Array.from(
    new Set(helpRequestList.map((hr) => hr.vehicle_id)),
  );

  const [
    { data: clients, error: clientsError },
    { data: vehicles, error: vehiclesError },
  ] = await Promise.all([
    clientIds.length
      ? supabase
          .from('users')
          .select('id, full_name, phone, avatar_url')
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabase
          .from('vehicles')
          .select('id, brand, model, year')
          .in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsError) throw clientsError;
  if (vehiclesError) throw vehiclesError;

  const helpRequestById = new Map(helpRequestList.map((hr) => [hr.id, hr]));
  const clientById = new Map(
    (clients ?? []).map((c: any) => [c.id as string, c]),
  );
  const vehicleById = new Map(
    (vehicles ?? []).map((v: any) => [v.id as string, v]),
  );

  return notificationList
    .map((notification) => {
      const helpRequest = helpRequestById.get(notification.help_request_id);
      if (!helpRequest) return null;
      const veh = vehicleById.get(helpRequest.vehicle_id) as any;
      return {
        notification,
        helpRequest,
        client: (clientById.get(helpRequest.client_id) as any) ?? null,
        vehicle: veh
          ? { brand: veh.brand, model: veh.model, year: veh.year }
          : null,
      };
    })
    .filter((item): item is PendingHelpRequest => item !== null);
}

export interface AcceptHelpRequestParams {
  helpRequestId: string;
  businessId: string;
}

// El tiempo estimado de llegada ya no se pide al taller -- update-help-request-eta
// lo calcula solo (Google Distance Matrix) en cuanto hay ubicación en vivo del taller.
export async function acceptHelpRequest(
  params: AcceptHelpRequestParams,
): Promise<void> {
  const { data, error } = await supabase
    .from('help_requests')
    .update({
      status: 'accepted',
      accepted_business_id: params.businessId,
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
    'Aceptaron tu solicitud de auxilio. Te avisaremos el tiempo estimado de llegada en cuanto lo tengamos.',
    { type: 'help_request_accepted', helpRequestId: acceptedRequest.id },
    'auxilio',
  );
}

export async function rejectHelpRequest(
  helpRequestId: string,
  businessId: string,
): Promise<void> {
  const { error } = await supabase
    .from('help_request_notifications')
    .update({ responded: true })
    .eq('help_request_id', helpRequestId)
    .eq('business_id', businessId);
  if (error) throw error;
}

export async function businessCancelAcceptedRequest(
  helpRequestId: string,
  businessId: string,
  businessName?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('help_requests')
    .update({
      status: 'pending',
      accepted_business_id: null,
      accepted_at: null,
      business_latitude: null,
      business_longitude: null,
      business_location_updated_at: null,
      estimated_arrival_minutes: null,
    })
    .eq('id', helpRequestId)
    .eq('accepted_business_id', businessId)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Ya no puedes cancelar esta solicitud.');
  }

  const request = data[0] as HelpRequest;
  const name = businessName ?? 'El taller';
  await notifyUser(
    request.client_id,
    'El taller canceló tu solicitud',
    `${name} canceló tu solicitud de auxilio. Seguimos buscando otro taller cercano que pueda ayudarte.`,
    { type: 'help_request_reopened', helpRequestId: request.id },
    'auxilio',
  );
}

// Piloto: además del aviso normal de "Auxilio completado", si este fue el
// PRIMER auxilio que esa cuenta completa (como cliente o como negocio), se
// suma un push aparte pidiendo sugerencias -- es la primera vez que esa
// cuenta vivió el flujo completo de punta a punta, el momento con más
// contexto real para pedir opinión. Sin categoría de notification_prefs a
// propósito (no encaja limpio en ninguna de las existentes, y es tan poco
// frecuente -- una sola vez por cuenta -- que no vale la pena inventar una).
async function promptPilotFeedbackIfFirstCompleted(
  filter: { column: 'client_id' | 'accepted_business_id'; value: string },
  notifyUserId: string,
): Promise<void> {
  const { count, error } = await supabase
    .from('help_requests')
    .select('id', { count: 'exact', head: true })
    .eq(filter.column, filter.value)
    .eq('status', 'completed');
  if (error) throw error;
  if (count !== 1) return;

  await notifyUser(
    notifyUserId,
    '¿Cómo te fue con tu primer auxilio?',
    'Estamos en piloto y tu opinión nos ayuda mucho -- cuéntanos qué te pareció.',
    { type: 'pilot_feedback_prompt' },
  );
}

export async function completeHelpRequest(
  helpRequestId: string,
  completedBy: 'client' | 'business',
): Promise<void> {
  const { data, error } = await supabase
    .from('help_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', helpRequestId)
    .select()
    .maybeSingle();
  if (error) throw error;

  const request = data as HelpRequest | null;
  if (!request) return;

  if (completedBy === 'business') {
    await notifyUser(
      request.client_id,
      'Auxilio completado',
      'El taller marcó tu auxilio como completado. Ya puedes calificar el servicio.',
      { type: 'help_request_completed', helpRequestId },
      'auxilio',
    );
    await promptPilotFeedbackIfFirstCompleted({ column: 'client_id', value: request.client_id }, request.client_id);
    return;
  }

  if (!request.accepted_business_id) return;
  const ownerId = await getBusinessOwnerForNotify(request.accepted_business_id);
  if (!ownerId) return;

  await notifyUser(
    ownerId,
    'Auxilio completado',
    'El cliente marcó el auxilio como completado. Ya puedes calificarlo.',
    { type: 'help_request_completed', helpRequestId },
    'auxilio',
  );
  await promptPilotFeedbackIfFirstCompleted(
    { column: 'accepted_business_id', value: request.accepted_business_id },
    ownerId,
  );
}

export async function getActiveBusinessRequest(
  businessId: string,
): Promise<HelpRequest | null> {
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
