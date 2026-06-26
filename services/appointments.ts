import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { Appointment } from '../types/database';

export interface CreateAppointmentParams {
  clientId: string;
  businessId: string;
  vehicleId?: string;
  serviceId?: string;
  notes?: string;
}

export async function createAppointment(params: CreateAppointmentParams): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      client_id: params.clientId,
      business_id: params.businessId,
      vehicle_id: params.vehicleId ?? null,
      service_id: params.serviceId ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const appointment = data as Appointment;

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', params.businessId)
    .maybeSingle();
  if (business) {
    await notifyUser(business.owner_id, 'Nueva solicitud de cita', 'Un cliente quiere agendar una cita.', {
      type: 'appointment_requested',
      appointmentId: appointment.id,
    });
  }

  return appointment;
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
}

export async function getBusinessAppointments(businessId: string): Promise<BusinessAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, services(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const clientIds = Array.from(new Set(rows.map((r: any) => r.client_id)));

  const { data: clients, error: clientsError } = clientIds.length
    ? await supabase.from('users').select('id, full_name, phone').in('id', clientIds)
    : { data: [], error: null };
  if (clientsError) throw clientsError;

  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  return rows.map((row: any) => ({
    ...row,
    service_name: row.services?.name ?? null,
    client: clientById.get(row.client_id) ?? null,
  })) as BusinessAppointment[];
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
  } else if (cancelledBy === 'business') {
    await notifyUser(appointment.client_id, 'Cita cancelada', 'El taller canceló la cita.', {
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
    });
  }
}

export async function requestReschedule(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'pending', requested_at: null })
    .eq('id', id)
    .select('*, businesses(owner_id)')
    .single();
  if (error) throw error;

  const appointment = data as unknown as Appointment & { businesses: { owner_id: string } | null };
  if (appointment.businesses) {
    await notifyUser(
      appointment.businesses.owner_id,
      'El cliente quiere reagendar',
      'Ponte de acuerdo con el cliente y propón una nueva fecha.',
      { type: 'appointment_reschedule_requested', appointmentId: appointment.id }
    );
  }
}

export async function scheduleAppointment(id: string, requestedAt: string): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'scheduled', requested_at: requestedAt })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const appointment = data as Appointment;
  await notifyUser(
    appointment.client_id,
    'El taller propuso una fecha',
    'Revisa la fecha y hora propuestas y apruébala.',
    { type: 'appointment_scheduled', appointmentId: appointment.id }
  );
}

export async function approveAppointment(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .select('*, businesses(owner_id)')
    .single();
  if (error) throw error;

  const appointment = data as unknown as Appointment & { businesses: { owner_id: string } | null };
  if (appointment.businesses) {
    await notifyUser(appointment.businesses.owner_id, 'Cita aprobada', 'El cliente aprobó la fecha de la cita.', {
      type: 'appointment_approved',
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
  await notifyUser(appointment.client_id, 'Cita rechazada', 'El negocio no pudo confirmar tu cita.', {
    type: 'appointment_rejected',
    appointmentId: appointment.id,
  });
}

export async function completeAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
  if (error) throw error;
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
