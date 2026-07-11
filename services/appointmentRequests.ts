import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { Appointment } from '../types/database';

export interface AppointmentRequest {
  id: string;
  client_id: string;
  business_id: string;
  service_id: string | null;
  vehicle_id: string | null;
  service_name: string | null;
  vehicle_label: string | null;
  notes: string | null;
  suggested_at: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface CreateAppointmentRequestParams {
  clientId: string;
  businessId: string;
  serviceId?: string;
  vehicleId?: string;
  serviceName?: string;
  vehicleLabel?: string;
  notes?: string;
  suggestedAt?: string;
}

export async function createAppointmentRequest(
  params: CreateAppointmentRequestParams
): Promise<AppointmentRequest> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .insert({
      client_id: params.clientId,
      business_id: params.businessId,
      service_id: params.serviceId ?? null,
      vehicle_id: params.vehicleId ?? null,
      service_name: params.serviceName ?? null,
      vehicle_label: params.vehicleLabel ?? null,
      notes: params.notes ?? null,
      suggested_at: params.suggestedAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const request = data as unknown as AppointmentRequest;

  // Mensaje automático en el chat con los detalles (insert directo para no duplicar push)
  const lines: string[] = ['📅 Solicitud de cita'];
  if (params.serviceName) lines.push(`Servicio: ${params.serviceName}`);
  if (params.vehicleLabel) lines.push(`Moto: ${params.vehicleLabel}`);
  if (params.notes) lines.push(`Notas: ${params.notes}`);
  if (params.suggestedAt) {
    const dtStr = new Date(params.suggestedAt).toLocaleString('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    lines.push(`Fecha sugerida: ${dtStr}`);
  }
  lines.push('Coordina los detalles aquí.');
  await supabase.from('messages').insert({
    client_id: params.clientId,
    business_id: params.businessId,
    sender_id: params.clientId,
    body: lines.join('\n'),
  });

  // Notificación push al taller
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', params.businessId)
    .maybeSingle();
  if (biz) {
    await notifyUser(
      biz.owner_id,
      'Nueva solicitud de cita',
      params.serviceName
        ? `Un cliente quiere agendar: ${params.serviceName}`
        : 'Un cliente quiere agendar una cita.',
      { type: 'appointment_requested', requestId: request.id }
    );
  }

  return request;
}

export async function getActiveAppointmentRequest(
  clientId: string,
  businessId: string
): Promise<AppointmentRequest | null> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as AppointmentRequest | null;
}

// Para la página de servicio: a diferencia de getActiveAppointmentRequest
// (solo 'pending', usada por el banner del chat), acá también incluimos
// 'accepted' para poder mostrar el estado "Cita confirmada" igual que
// product_intents muestra "Apartado confirmado".
export async function getAppointmentRequestForService(
  clientId: string,
  businessId: string,
  serviceId: string
): Promise<AppointmentRequest | null> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .eq('service_id', serviceId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as AppointmentRequest | null;
}

export async function cancelAppointmentRequest(
  request: AppointmentRequest
): Promise<void> {
  const { error } = await supabase
    .from('appointment_requests')
    .update({ status: 'cancelled' })
    .eq('id', request.id);
  if (error) throw error;

  // Mensaje automático en el chat
  await supabase.from('messages').insert({
    client_id: request.client_id,
    business_id: request.business_id,
    sender_id: request.client_id,
    body: '❌ El cliente canceló la solicitud de cita.',
  });

  // Push al taller
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', request.business_id)
    .maybeSingle();
  if (biz) {
    await notifyUser(biz.owner_id, 'Solicitud cancelada', 'El cliente canceló su solicitud de cita.', {
      type: 'appointment_cancelled',
    });
  }
}

export async function rejectAppointmentRequest(
  request: AppointmentRequest
): Promise<void> {
  const { error } = await supabase
    .from('appointment_requests')
    .update({ status: 'rejected' })
    .eq('id', request.id);
  if (error) throw error;

  // Solo push, sin mensaje en el chat (según el flujo acordado)
  await notifyUser(
    request.client_id,
    'Solicitud de cita rechazada',
    'El taller no pudo aceptar tu solicitud. Intenta con otro horario.',
    { type: 'appointment_rejected' }
  );
}

export async function acceptAppointmentRequest(
  request: AppointmentRequest,
  confirmedAt: string
): Promise<Appointment> {
  // 1. Crear la cita confirmada directamente
  const { data: apptData, error: apptError } = await supabase.from('appointments').insert({
    client_id: request.client_id,
    business_id: request.business_id,
    vehicle_id: request.vehicle_id ?? null,
    service_id: request.service_id ?? null,
    notes: request.notes ?? null,
    requested_at: confirmedAt,
    proposed_by: null,
    status: 'confirmed',
  }).select().single();
  if (apptError) throw apptError;
  const appointment = apptData as unknown as Appointment;

  // 2. Marcar la solicitud como aceptada
  const { error } = await supabase
    .from('appointment_requests')
    .update({ status: 'accepted' })
    .eq('id', request.id);
  if (error) throw error;

  // 3. Mensaje de confirmación en el chat
  const dtStr = new Date(confirmedAt).toLocaleString('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', request.business_id)
    .maybeSingle();
  await supabase.from('messages').insert({
    client_id: request.client_id,
    business_id: request.business_id,
    sender_id: biz?.owner_id ?? request.business_id,
    body: `✅ Cita confirmada para el ${dtStr}. Puedes verla en "Mis citas".`,
  });

  // 4. Notificación push al cliente
  await notifyUser(
    request.client_id,
    '¡Cita confirmada!',
    `Tu cita fue agendada para el ${dtStr}.`,
    { type: 'appointment_approved' }
  );

  return appointment;
}

export function subscribeToAppointmentRequest(
  clientId: string,
  businessId: string,
  role: 'client' | 'business',
  onChange: (request: AppointmentRequest) => void
) {
  const filter =
    role === 'client' ? `client_id=eq.${clientId}` : `business_id=eq.${businessId}`;
  const channel = supabase
    .channel(`appreq_${clientId}_${businessId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointment_requests', filter },
      (payload) => {
        const req = payload.new as AppointmentRequest;
        if (req.client_id === clientId && req.business_id === businessId) {
          onChange(req);
        }
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
