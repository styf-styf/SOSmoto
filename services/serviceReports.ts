import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { InspectionGroup, InspectionItem, ServiceCategory, ServiceReport, ServiceReportPart } from '../types/database';

export type { InspectionGroup, InspectionItem, ServiceCategory, ServiceReportPart };

export interface ServiceReportWithBusiness extends ServiceReport {
  business_name: string;
  client_name?: string | null;
}

export interface CreateServiceReportParams {
  businessId: string;
  clientId?: string;
  appointmentId?: string;
  helpRequestId?: string;
  vehicleLabel?: string;
  externalClientName?: string;
  serviceCategory?: ServiceCategory;
  serviceKm?: number;
  vehiclePlate?: string;
  entryDate?: string;
  exitDate?: string;
  servicesPerformed: string[];
  partsUsed?: ServiceReportPart[];
  inspectionChecklist?: InspectionGroup[];
  observations?: string;
  recommendations?: string;
  nextMaintenanceKm?: number;
  nextMaintenanceDate?: string;
}

export async function createServiceReport(
  params: CreateServiceReportParams
): Promise<ServiceReport> {
  const { data, error } = await (supabase.from('service_reports') as any)
    .insert({
      business_id: params.businessId,
      client_id: params.clientId ?? null,
      appointment_id: params.appointmentId ?? null,
      help_request_id: params.helpRequestId ?? null,
      vehicle_label: params.vehicleLabel ?? null,
      external_client_name: params.externalClientName ?? null,
      service_category: params.serviceCategory ?? null,
      service_km: params.serviceKm ?? null,
      vehicle_plate: params.vehiclePlate ?? null,
      entry_date: params.entryDate ?? null,
      exit_date: params.exitDate ?? null,
      services_performed: params.servicesPerformed,
      parts_used: params.partsUsed && params.partsUsed.length > 0 ? params.partsUsed : null,
      inspection_checklist: params.inspectionChecklist && params.inspectionChecklist.length > 0
        ? params.inspectionChecklist
        : null,
      observations: params.observations ?? null,
      recommendations: params.recommendations ?? null,
      next_maintenance_km: params.nextMaintenanceKm ?? null,
      next_maintenance_date: params.nextMaintenanceDate ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const report = data as ServiceReport;

  if (params.clientId) {
    await notifyUser(
      params.clientId,
      'Informe de servicio recibido',
      'Tu taller envió un informe del servicio realizado. Tócalo para verlo.',
      { type: 'service_report', reportId: report.id }
    );
  }

  return report;
}

export async function getServiceReport(id: string): Promise<ServiceReportWithBusiness | null> {
  const { data, error } = await (supabase.from('service_reports') as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const report = data as ServiceReport;

  const [{ data: business }, { data: clientUser }] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', report.business_id).maybeSingle(),
    report.client_id
      ? supabase.from('users').select('full_name').eq('id', report.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...report,
    business_name: (business as any)?.name ?? 'Taller',
    client_name: (clientUser as any)?.full_name ?? report.external_client_name ?? null,
  };
}

// Devuelve un mapa appointmentId → reportId para las citas del negocio.
export async function getReportIdsByAppointments(
  businessId: string
): Promise<Map<string, string>> {
  const { data, error } = await (supabase.from('service_reports') as any)
    .select('id, appointment_id')
    .eq('business_id', businessId)
    .not('appointment_id', 'is', null);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    if (row.appointment_id) map.set(row.appointment_id, row.id);
  }
  return map;
}

// Devuelve un mapa appointmentId → reportId para el cliente (lado cliente).
export async function getClientReportIdsByAppointments(
  clientId: string
): Promise<Map<string, string>> {
  const { data, error } = await (supabase.from('service_reports') as any)
    .select('id, appointment_id')
    .eq('client_id', clientId)
    .not('appointment_id', 'is', null);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    if (row.appointment_id) map.set(row.appointment_id, row.id);
  }
  return map;
}

export async function confirmServiceReport(id: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('confirm_service_report', { report_id: id });
  if (error) throw error;
}

// Todos los informes de un cliente con un negocio específico (para CRM).
export async function getBusinessClientReports(
  businessId: string,
  clientId: string
): Promise<ServiceReport[]> {
  const { data, error } = await (supabase.from('service_reports') as any)
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceReport[];
}
