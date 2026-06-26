import { supabase } from './supabase';
import type { Appointment, Business, HelpRequest, Review } from '../types/database';

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
  kind: 'help_request' | 'appointment';
  status: string;
  createdAt: string;
  description: string | null;
  business: Business | null;
  review: Review | null;
  helpRequestId?: string;
  appointmentId?: string;
}

export async function getServiceHistory(clientId: string): Promise<ServiceHistoryItem[]> {
  const [helpRequestsResult, appointmentsResult] = await Promise.all([
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
  ]);
  if (helpRequestsResult.error) throw helpRequestsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;

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

  const helpRequestItems: ServiceHistoryItem[] = helpRequests.map((hr) => ({
    id: hr.id,
    kind: 'help_request',
    status: hr.status,
    createdAt: hr.created_at,
    description: hr.description,
    business: hr.accepted_business_id ? businessById.get(hr.accepted_business_id) ?? null : null,
    review: reviewByHelpRequestId.get(hr.id) ?? null,
    helpRequestId: hr.id,
  }));

  const appointmentItems: ServiceHistoryItem[] = appointmentRows.map((appt) => ({
    id: appt.id,
    kind: 'appointment',
    status: appt.status,
    createdAt: appt.created_at,
    description: appt.services?.name ?? appt.notes ?? null,
    business: businessById.get(appt.business_id) ?? null,
    review: reviewByAppointmentId.get(appt.id) ?? null,
    appointmentId: appt.id,
  }));

  return [...helpRequestItems, ...appointmentItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
