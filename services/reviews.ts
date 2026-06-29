import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { Appointment, Business, HelpRequest, MaintenanceSuggestion, Review, Vehicle } from '../types/database';

export interface CreateReviewParams {
  reviewerId: string;
  businessId: string;
  helpRequestId?: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
}

export async function createReview(params: CreateReviewParams): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      reviewer_id: params.reviewerId,
      reviewed_business_id: params.businessId,
      help_request_id: params.helpRequestId ?? null,
      appointment_id: params.appointmentId ?? null,
      rating: params.rating,
      comment: params.comment ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', params.businessId)
    .maybeSingle();
  if (business?.owner_id) {
    await notifyUser(
      business.owner_id,
      'Nueva calificación',
      `Un cliente calificó tu negocio con ${params.rating} estrella${params.rating === 1 ? '' : 's'}.`,
      { type: 'new_review', businessId: params.businessId }
    );
  }

  return data as Review;
}

export interface CreateClientReviewParams {
  reviewerId: string;
  clientId: string;
  helpRequestId?: string;
  appointmentId?: string;
  rating: number;
  comment?: string;
}

// Calificación interna negocio -> cliente. No es pública, solo alimenta el
// algoritmo de matching de auxilio (clientes que cancelan o no se presentan).
export async function createClientReview(params: CreateClientReviewParams): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      reviewer_id: params.reviewerId,
      reviewed_client_id: params.clientId,
      help_request_id: params.helpRequestId ?? null,
      appointment_id: params.appointmentId ?? null,
      rating: params.rating,
      comment: params.comment ?? null,
      is_public: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Review;
}

export async function getReviewedTargetIds(
  reviewerId: string
): Promise<{ appointmentIds: Set<string>; helpRequestIds: Set<string> }> {
  const { data, error } = await supabase
    .from('reviews')
    .select('appointment_id, help_request_id')
    .eq('reviewer_id', reviewerId)
    .not('reviewed_client_id', 'is', null);
  if (error) throw error;

  const appointmentIds = new Set<string>();
  const helpRequestIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.appointment_id) appointmentIds.add(row.appointment_id);
    if (row.help_request_id) helpRequestIds.add(row.help_request_id);
  }
  return { appointmentIds, helpRequestIds };
}

export async function getBusinessReviews(businessId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewed_business_id', businessId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Review[];
}

export interface ServiceHistoryItem {
  id: string;
  kind: 'help_request' | 'appointment' | 'maintenance';
  title: string;
  status: string;
  createdAt: string;
  description: string | null;
  business: Business | null;
  review: Review | null;
  helpRequestId?: string;
  appointmentId?: string;
}

export async function getServiceHistory(clientId: string): Promise<ServiceHistoryItem[]> {
  const [helpRequestsResult, appointmentsResult, vehiclesResult] = await Promise.all([
    supabase
      .from('help_requests')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('*, services(name)')
      .eq('client_id', clientId)
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false }),
    supabase.from('vehicles').select('id, brand, model').eq('user_id', clientId),
  ]);
  if (helpRequestsResult.error) throw helpRequestsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;

  const vehicles = (vehiclesResult.data ?? []) as Pick<Vehicle, 'id' | 'brand' | 'model'>[];
  const vehicleIds = vehicles.map((v) => v.id);

  const { data: maintenanceData, error: maintenanceError } = vehicleIds.length
    ? await supabase
        .from('maintenance_suggestions')
        .select('*')
        .in('vehicle_id', vehicleIds)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
    : { data: [] as MaintenanceSuggestion[], error: null };
  if (maintenanceError) throw maintenanceError;

  const maintenanceSuggestions = (maintenanceData ?? []) as MaintenanceSuggestion[];
  const ruleIds = Array.from(new Set(maintenanceSuggestions.map((s) => s.rule_id)));
  const { data: rulesData, error: rulesError } = ruleIds.length
    ? await supabase.from('maintenance_rules').select('id, service_name').in('id', ruleIds)
    : { data: [] as { id: string; service_name: string }[], error: null };
  if (rulesError) throw rulesError;

  const helpRequests = (helpRequestsResult.data ?? []) as HelpRequest[];
  const appointmentRows = (appointmentsResult.data ?? []) as unknown as (Appointment & {
    services: { name: string } | null;
  })[];

  const businessIds = Array.from(
    new Set([
      ...helpRequests.map((r) => r.accepted_business_id).filter((id): id is string => !!id),
      ...appointmentRows.map((a) => a.business_id),
    ])
  );
  const helpRequestIds = helpRequests.map((r) => r.id);
  const appointmentIds = appointmentRows.map((a) => a.id);

  const [businessesResult, hrReviewsResult, apptReviewsResult] = await Promise.all([
    businessIds.length
      ? supabase.from('businesses').select('*').in('id', businessIds)
      : Promise.resolve({ data: [] as Business[], error: null }),
    helpRequestIds.length
      ? supabase.from('reviews').select('*').in('help_request_id', helpRequestIds)
      : Promise.resolve({ data: [] as Review[], error: null }),
    appointmentIds.length
      ? supabase.from('reviews').select('*').in('appointment_id', appointmentIds)
      : Promise.resolve({ data: [] as Review[], error: null }),
  ]);
  if (businessesResult.error) throw businessesResult.error;
  if (hrReviewsResult.error) throw hrReviewsResult.error;
  if (apptReviewsResult.error) throw apptReviewsResult.error;

  const businessById = new Map(((businessesResult.data ?? []) as Business[]).map((b) => [b.id, b]));
  const reviewByHelpRequestId = new Map(
    ((hrReviewsResult.data ?? []) as Review[])
      .filter((r) => r.help_request_id)
      .map((r) => [r.help_request_id as string, r])
  );
  const reviewByAppointmentId = new Map(
    ((apptReviewsResult.data ?? []) as Review[])
      .filter((r) => r.appointment_id)
      .map((r) => [r.appointment_id as string, r])
  );

  const helpRequestItems: ServiceHistoryItem[] = helpRequests.map((hr) => {
    const business = hr.accepted_business_id ? businessById.get(hr.accepted_business_id) ?? null : null;
    return {
      id: hr.id,
      kind: 'help_request',
      title: business?.name ?? 'Taller',
      status: hr.status,
      createdAt: hr.created_at,
      description: hr.description,
      business,
      review: reviewByHelpRequestId.get(hr.id) ?? null,
      helpRequestId: hr.id,
    };
  });

  const appointmentItems: ServiceHistoryItem[] = appointmentRows.map((appt) => {
    const business = businessById.get(appt.business_id) ?? null;
    return {
      id: appt.id,
      kind: 'appointment',
      title: business?.name ?? 'Taller',
      status: appt.status,
      createdAt: appt.created_at,
      description: appt.services?.name ?? appt.notes ?? null,
      business,
      review: reviewByAppointmentId.get(appt.id) ?? null,
      appointmentId: appt.id,
    };
  });

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const ruleById = new Map(((rulesData ?? []) as { id: string; service_name: string }[]).map((r) => [r.id, r]));

  const maintenanceItems: ServiceHistoryItem[] = maintenanceSuggestions.map((suggestion) => {
    const vehicle = vehicleById.get(suggestion.vehicle_id);
    const rule = ruleById.get(suggestion.rule_id);
    return {
      id: suggestion.id,
      kind: 'maintenance',
      title: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Tu moto',
      status: 'completed',
      createdAt: suggestion.completed_at ?? suggestion.created_at,
      description:
        `${rule?.service_name ?? 'Mantenimiento'}` +
        (suggestion.completed_at_km !== null ? ` · ${suggestion.completed_at_km.toLocaleString()} km` : ''),
      business: null,
      review: null,
    };
  });

  return [...helpRequestItems, ...appointmentItems, ...maintenanceItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
