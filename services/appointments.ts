import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { Appointment, AppointmentStatus, VehicleInfo } from '../types/database';

// Estadísticas de un servicio puntual (para la vista del negocio en su
// propia página de servicio: citas activas y citas completadas).
export async function getServiceAppointmentStats(serviceId: string): Promise<{ reservations: number; completed: number }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('status')
    .eq('service_id', serviceId)
    .in('status', ['pending', 'scheduled', 'confirmed', 'completed']);
  if (error) throw error;
  const rows = data ?? [];
  return {
    reservations: rows.filter((r) => r.status === 'pending' || r.status === 'scheduled' || r.status === 'confirmed').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  };
}

export interface ClientAppointment extends Appointment {
  business_name: string;
  service_name: string | null;
}

export async function getClientAppointments(clientId: string): Promise<ClientAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, businesses(name), services(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    business_name: row.businesses?.name ?? '',
    service_name: row.services?.name ?? null,
  })) as ClientAppointment[];
}

export interface BusinessAppointment extends Appointment {
  service_name: string | null;
  client: { full_name: string; phone: string | null } | null;
  vehicle: VehicleInfo | null;
  // Nombre de display calculado: usa client.full_name si existe, si no external_client_name
  display_name: string;
}

export async function getBusinessAppointments(businessId: string): Promise<BusinessAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, services(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const clientIds = Array.from(
    new Set(rows.map((r: any) => r.client_id as string | null).filter((id): id is string => id !== null))
  );
  const vehicleIds = Array.from(
    new Set(rows.map((r: any) => r.vehicle_id as string | null).filter((v): v is string => Boolean(v)))
  );

  const [{ data: clients, error: clientsError }, { data: vehicles, error: vehiclesError }] =
    await Promise.all([
      clientIds.length
        ? supabase.from('users').select('id, full_name, phone').in('id', clientIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length
        ? supabase.from('vehicles').select('id, brand, model, year, plate').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (clientsError) throw clientsError;
  if (vehiclesError) throw vehiclesError;

  const clientById = new Map((clients ?? []).map((c: any) => [c.id as string, c]));
  const vehicleById = new Map((vehicles ?? []).map((v: any) => [v.id as string, v]));

  return rows.map((row: any) => {
    const veh = row.vehicle_id ? (vehicleById.get(row.vehicle_id) as any) ?? null : null;
    const client = row.client_id ? ((clientById.get(row.client_id) as any) ?? null) : null;
    const displayName = client?.full_name ?? row.external_client_name ?? 'Cliente';
    return {
      ...row,
      service_name: row.services?.name ?? null,
      client,
      vehicle: veh ? { brand: veh.brand, model: veh.model, year: veh.year, plate: veh.plate ?? null } : null,
      display_name: displayName,
    };
  }) as BusinessAppointment[];
}

// Propone o contra-propone una fecha. Lo llaman tanto el taller ('business')
// como el cliente ('client'). Siempre deja status = 'scheduled' y actualiza
// proposed_by para que el otro lado sepa que es su turno.
export async function proposeDate(
  id: string,
  requestedAt: string,
  proposedBy: 'client' | 'business'
): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'scheduled', requested_at: requestedAt, proposed_by: proposedBy })
    .eq('id', id)
    .select('*, businesses(owner_id)')
    .single();
  if (error) throw error;

  const appointment = data as unknown as Appointment & { businesses: { owner_id: string } | null };
  if (proposedBy === 'business' && appointment.businesses && appointment.client_id) {
    await notifyUser(
      appointment.client_id,
      'El taller propuso una fecha',
      'Revisa la fecha y hora propuestas y apruébala o sugiere otra.',
      { type: 'appointment_scheduled', appointmentId: appointment.id }
    );
  } else if (proposedBy === 'client' && appointment.businesses) {
    await notifyUser(
      appointment.businesses.owner_id,
      'El cliente propuso otra fecha',
      'El cliente sugirió un nuevo horario. Acéptalo o propón otro.',
      { type: 'appointment_reschedule_requested', appointmentId: appointment.id }
    );
  }
}

// Reagenda una cita de cliente externo: confirma directamente sin esperar aprobación.
export async function rescheduleDirect(id: string, requestedAt: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed', requested_at: requestedAt, proposed_by: null })
    .eq('id', id);
  if (error) throw error;
}

// El lado que NO propuso aprueba la fecha → status = 'confirmed'.
// Lee proposed_by de la DB para saber a quién notificar.
export async function approveAppointment(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .select('*, businesses(owner_id)')
    .single();
  if (error) throw error;

  const appointment = data as unknown as Appointment & { businesses: { owner_id: string } | null };
  if (appointment.proposed_by === 'business' && appointment.businesses) {
    // Cliente aprobó → notificar al taller
    await notifyUser(appointment.businesses.owner_id, 'Cita aprobada', 'El cliente aprobó la fecha de la cita.', {
      type: 'appointment_approved',
      appointmentId: appointment.id,
    });
  } else if (appointment.proposed_by === 'client' && appointment.client_id) {
    // Taller aprobó → notificar al cliente
    await notifyUser(appointment.client_id, 'Cita confirmada', 'El taller aceptó tu fecha propuesta.', {
      type: 'appointment_approved',
      appointmentId: appointment.id,
    });
  }
}

// Para la página de servicio: encuentra la cita real (tabla appointments,
// creada por acceptAppointmentRequest) que corresponde a una solicitud ya
// aceptada de este servicio, para poder cancelarla directo desde ahí sin
// tener que ir a "Mis citas".
export async function getActiveAppointmentForService(
  clientId: string,
  businessId: string,
  serviceId: string
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .eq('service_id', serviceId)
    .in('status', ['pending', 'scheduled', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Appointment | null;
}

export async function cancelAppointment(id: string, cancelledBy: 'client' | 'business'): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('*, businesses(owner_id)')
    .single();
  if (error) throw error;

  const appointment = data as unknown as Appointment & { businesses: { owner_id: string } | null };
  if (cancelledBy === 'client' && appointment.businesses) {
    await notifyUser(appointment.businesses.owner_id, 'Cita cancelada', 'El cliente canceló la cita.', {
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
    });
  } else if (cancelledBy === 'business' && appointment.client_id) {
    await notifyUser(appointment.client_id, 'Cita cancelada', 'El taller canceló la cita.', {
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
    });
  }
}

export async function rejectAppointment(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'rejected' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const appointment = data as Appointment;
  if (appointment.client_id) {
    await notifyUser(appointment.client_id, 'Cita rechazada', 'El negocio no pudo confirmar tu cita.', {
      type: 'appointment_rejected',
      appointmentId: appointment.id,
    });
  }
}

export async function completeAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
  if (error) throw error;
}

// ─── Creación de cita por el taller ────────────────────────────────────────

export interface CreateAppointmentByBusinessParams {
  businessId: string;
  scheduledAt: string;
  // Cliente en la app
  clientId?: string;
  serviceId?: string;
  serviceName?: string;
  vehicleId?: string;
  notes?: string;
  // Cliente externo (sin cuenta)
  externalClientName?: string;
  externalClientPhone?: string;
}

export async function createAppointmentByBusiness(
  params: CreateAppointmentByBusinessParams
): Promise<Appointment> {
  const isExternal = !params.clientId;

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      business_id: params.businessId,
      client_id: params.clientId ?? null,
      service_id: params.serviceId ?? null,
      vehicle_id: params.vehicleId ?? null,
      notes: params.notes ?? null,
      requested_at: params.scheduledAt,
      proposed_by: isExternal ? null : 'business',
      status: isExternal ? 'confirmed' : 'scheduled',
      external_client_name: params.externalClientName ?? null,
      external_client_phone: params.externalClientPhone ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const appointment = data as Appointment;

  if (!isExternal && params.clientId) {
    // Notificar al cliente en la app
    const svcLabel = params.serviceName ? `· ${params.serviceName}` : '';
    const dtStr = new Date(params.scheduledAt).toLocaleString('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    await notifyUser(
      params.clientId,
      'El taller quiere agendar una cita',
      `Propuesta para el ${dtStr} ${svcLabel}. Revísala en "Mis citas".`,
      { type: 'appointment_scheduled', appointmentId: appointment.id }
    );
  }

  return appointment;
}

// Clientes que han chateado con el negocio (para búsqueda al crear cita)
export interface ActiveClientAppointment {
  id: string;
  status: AppointmentStatus;
  requested_at: string | null;
  proposed_by: 'client' | 'business' | null;
  service_name: string | null;
  notes: string | null;
}

export async function getActiveClientAppointments(
  businessId: string,
  clientId: string
): Promise<ActiveClientAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status, requested_at, proposed_by, notes, services(name)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .in('status', ['pending', 'scheduled', 'confirmed'])
    .order('requested_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    requested_at: r.requested_at ?? null,
    proposed_by: r.proposed_by ?? null,
    service_name: r.services?.name ?? null,
    notes: r.notes ?? null,
  }));
}

export function subscribeToClientAppointments(clientId: string, onChange: () => void) {
  const channel = supabase
    .channel(`client_appointments_${clientId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments', filter: `client_id=eq.${clientId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToBusinessAppointments(businessId: string, onChange: () => void) {
  const channel = supabase
    .channel(`business_appointments_${businessId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments', filter: `business_id=eq.${businessId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
