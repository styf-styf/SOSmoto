import { supabase } from './supabase';
import { getBusinessOwnerForNotify } from './businesses';
import { notifyUser } from './notifications';
import { subscribeToTable } from './realtime';
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

export interface ClientAppointmentRequest extends AppointmentRequest {
  business_name: string;
}

// Para "Mis citas": mientras una solicitud está pending nunca existió una
// fila en `appointments` (esa solo se crea al aceptar, ver
// acceptAppointmentRequest), así que sin esto el cliente no tenía forma de
// ver "esperando respuesta del taller" en un solo lugar centralizado. Solo
// 'pending' a propósito -- igual que la página de servicio (de donde viene
// la solicitud), rejected/cancelled no se quedan mostrando como historial
// ahí tampoco, el cliente ya se entera por el chat en el momento.
export async function getClientAppointmentRequests(clientId: string): Promise<ClientAppointmentRequest[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*, businesses:businesses_public(name)')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    business_name: row.businesses?.name ?? '',
  })) as ClientAppointmentRequest[];
}

export function subscribeToClientAppointmentRequests(clientId: string, onChange: () => void) {
  return subscribeToTable(
    `client_appointment_requests_${clientId}`,
    'appointment_requests',
    '*',
    `client_id=eq.${clientId}`,
    onChange
  );
}

export interface BusinessAppointmentRequest extends AppointmentRequest {
  client_name: string;
  client_avatar_url: string | null;
}

// Simétrico a getClientAppointmentRequests -- para la agenda del taller
// (antes solo se veían/respondían desde el banner del chat, sin una vista
// centralizada como la que ya tiene el cliente en "Mis citas"). Batch
// query aparte a `users` (no join embebido) -- mismo patrón que
// getBusinessAppointments, porque el join directo a `users` no siempre
// pasa las políticas RLS al leer desde el lado del negocio.
export async function getBusinessAppointmentRequests(businessId: string): Promise<BusinessAppointmentRequest[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const clientIds = Array.from(new Set(rows.map((r: any) => r.client_id as string)));
  const { data: clients, error: clientsError } = clientIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url').in('id', clientIds)
    : { data: [], error: null };
  if (clientsError) throw clientsError;
  const clientById = new Map((clients ?? []).map((c: any) => [c.id as string, c]));

  return rows.map((row: any) => {
    const client = clientById.get(row.client_id);
    return {
      ...row,
      client_name: client?.full_name ?? 'Cliente',
      client_avatar_url: client?.avatar_url ?? null,
    };
  }) as BusinessAppointmentRequest[];
}

export function subscribeToBusinessAppointmentRequests(businessId: string, onChange: () => void) {
  return subscribeToTable(
    `business_appointment_requests_${businessId}`,
    'appointment_requests',
    '*',
    `business_id=eq.${businessId}`,
    onChange
  );
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
  const ownerId = await getBusinessOwnerForNotify(params.businessId);
  if (ownerId) {
    await notifyUser(
      ownerId,
      'Nueva solicitud de cita',
      params.serviceName
        ? `Un cliente quiere agendar: ${params.serviceName}`
        : 'Un cliente quiere agendar una cita.',
      { type: 'appointment_requested', requestId: request.id }
    );
  }

  return request;
}

// Devuelve TODAS las solicitudes pendientes entre este cliente y este
// negocio -- antes había una versión "singular" (limit 1) que asumía que
// nunca habría más de una solicitud pendiente a la vez. Si el cliente
// agenda dos o más servicios seguidos con el mismo taller antes de que
// respondan, esa versión solo mostraba la última y la suscripción en
// tiempo real sobrescribía el estado en vez de acumularlo -- el banner del
// chat se veía "montado"/cortado y, al aceptar una, la otra desaparecía
// hasta cerrar y volver a abrir el chat.
export async function getActiveAppointmentRequests(
  clientId: string,
  businessId: string
): Promise<AppointmentRequest[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRequest[];
}

// Para la página de servicio: a diferencia de getActiveAppointmentRequests
// (solo 'pending', usada por el banner del chat), acá también incluimos
// 'accepted' para poder mostrar el estado "Cita confirmada" igual que
// product_intents muestra "Apartado confirmado".
// serviceId acepta null -- también lo usa nueva-cita.tsx para el caso "cita
// sin servicio específico" (revisión genérica), donde hay que comparar
// contra otras citas TAMBIÉN sin servicio (service_id IS NULL en SQL, `.eq`
// con null no sirve para eso).
export async function getAppointmentRequestForService(
  clientId: string,
  businessId: string,
  serviceId: string | null
): Promise<AppointmentRequest | null> {
  let query = supabase
    .from('appointment_requests')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .in('status', ['pending', 'accepted']);
  query = serviceId ? query.eq('service_id', serviceId) : query.is('service_id', null);
  const { data, error } = await query
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

  // Push al taller
  const ownerId = await getBusinessOwnerForNotify(request.business_id);
  if (ownerId) {
    await notifyUser(ownerId, 'Solicitud cancelada', 'El cliente canceló su solicitud de cita.', {
      type: 'appointment_cancelled',
    });
  }
  // Mensaje de cierre en el chat -- antes el hilo quedaba "cortado" sin
  // explicación tras el mensaje inicial de "📅 Solicitud de cita", como si
  // el negocio nunca hubiera respondido.
  await supabase.from('messages').insert({
    client_id: request.client_id,
    business_id: request.business_id,
    sender_id: request.client_id,
    body: '❌ Solicitud de cita cancelada por el cliente.',
  });
}

export async function rejectAppointmentRequest(
  request: AppointmentRequest
): Promise<void> {
  const { error } = await supabase
    .from('appointment_requests')
    .update({ status: 'rejected' })
    .eq('id', request.id);
  if (error) throw error;

  await notifyUser(
    request.client_id,
    'Solicitud de cita rechazada',
    'El taller no pudo aceptar tu solicitud. Intenta con otro horario.',
    { type: 'appointment_rejected' }
  );
  // Mismo motivo que cancelAppointmentRequest -- cierra el hilo con un
  // mensaje explícito en vez de dejarlo sin respuesta visible. sender_id debe
  // ser quien está autenticado ahora mismo (RLS de messages exige
  // sender_id = auth.uid()) -- puede ser el dueño o cualquier empleado con
  // permiso, nunca asumir que es el dueño.
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('messages').insert({
      client_id: request.client_id,
      business_id: request.business_id,
      sender_id: authData.user.id,
      body: '❌ El negocio no pudo confirmar tu solicitud de cita.',
    });
  }
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
  // sender_id debe ser quien está autenticado ahora mismo (RLS de messages
  // exige sender_id = auth.uid()) -- si es un empleado (no el dueño) quien
  // confirma, usar owner_id acá hacía que este insert fallara silenciosamente
  // por RLS (el error no se capturaba) y la cita quedaba confirmada sin
  // ningún mensaje de cierre en el chat.
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('messages').insert({
      client_id: request.client_id,
      business_id: request.business_id,
      sender_id: authData.user.id,
      body: `✅ Cita confirmada para el ${dtStr}. Puedes verla en "Mis citas".`,
    });
  }

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
  return subscribeToTable<AppointmentRequest>(
    `appreq_${clientId}_${businessId}`,
    'appointment_requests',
    '*',
    filter,
    (payload) => {
      const req = payload.new as AppointmentRequest;
      if (req.client_id === clientId && req.business_id === businessId) {
        onChange(req);
      }
    }
  );
}
