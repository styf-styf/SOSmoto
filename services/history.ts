import { supabase } from './supabase';
import type { VehicleInfo } from '../types/database';

export interface HistoryItem {
  id: string;
  type: 'aid' | 'appointment';
  date: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  vehicle: VehicleInfo | null;
  description: string | null;
}

export interface ClientProfileForBusiness {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  vehicles: Array<VehicleInfo & { id: string; current_mileage: number }>;
}

type RawClient = { id: string; full_name: string; phone: string | null };
type RawVehicle = { id: string; brand: string; model: string; year: number };

async function batchClients(ids: string[]): Promise<Map<string, RawClient>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('users').select('id, full_name, phone').in('id', ids);
  if (error) throw error;
  return new Map((data ?? []).map((c: any) => [c.id as string, c as RawClient]));
}

async function batchVehicles(ids: string[]): Promise<Map<string, RawVehicle>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('vehicles').select('id, brand, model, year').in('id', ids);
  if (error) throw error;
  return new Map((data ?? []).map((v: any) => [v.id as string, v as RawVehicle]));
}

export async function getBusinessHistory(
  businessId: string,
  opts?: { clientId?: string; limit?: number }
): Promise<HistoryItem[]> {
  const { clientId, limit = 100 } = opts ?? {};

  let aidQuery = supabase
    .from('help_requests')
    .select('id, client_id, vehicle_id, description, completed_at, created_at')
    .eq('accepted_business_id', businessId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (clientId) aidQuery = aidQuery.eq('client_id', clientId);

  let apptQuery = supabase
    .from('appointments')
    .select('id, client_id, vehicle_id, service_id, scheduled_at, requested_at')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(limit);
  if (clientId) apptQuery = apptQuery.eq('client_id', clientId);

  const [{ data: aidRows, error: aidErr }, { data: apptRows, error: apptErr }] = await Promise.all([
    aidQuery,
    apptQuery,
  ]);
  if (aidErr) throw aidErr;
  if (apptErr) throw apptErr;

  const allClientIds = [
    ...new Set([
      ...(aidRows ?? []).map((r: any) => r.client_id as string),
      ...(apptRows ?? []).map((r: any) => r.client_id as string),
    ]),
  ];
  const allVehicleIds = [
    ...new Set([
      ...(aidRows ?? []).map((r: any) => r.vehicle_id as string).filter(Boolean),
      ...(apptRows ?? []).map((r: any) => r.vehicle_id as string | null).filter((v): v is string => Boolean(v)),
    ]),
  ];
  const serviceIds = [
    ...new Set((apptRows ?? []).map((r: any) => r.service_id as string | null).filter((v): v is string => Boolean(v))),
  ];

  const [clientMap, vehicleMap] = await Promise.all([
    batchClients(allClientIds),
    batchVehicles(allVehicleIds),
  ]);

  let serviceMap = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from('services').select('id, name').in('id', serviceIds);
    serviceMap = new Map((services ?? []).map((s: any) => [s.id as string, s.name as string]));
  }

  const aidItems: HistoryItem[] = (aidRows ?? []).map((r: any) => {
    const client = clientMap.get(r.client_id);
    const veh = r.vehicle_id ? vehicleMap.get(r.vehicle_id) ?? null : null;
    return {
      id: `aid:${r.id}`,
      type: 'aid' as const,
      date: r.completed_at ?? r.created_at,
      clientId: r.client_id,
      clientName: client?.full_name ?? 'Cliente',
      clientPhone: client?.phone ?? null,
      vehicle: veh ? { brand: veh.brand, model: veh.model, year: veh.year } : null,
      description: r.description ?? null,
    };
  });

  const apptItems: HistoryItem[] = (apptRows ?? []).map((r: any) => {
    const client = clientMap.get(r.client_id);
    const veh = r.vehicle_id ? vehicleMap.get(r.vehicle_id) ?? null : null;
    return {
      id: `appt:${r.id}`,
      type: 'appointment' as const,
      date: r.scheduled_at ?? r.requested_at ?? r.created_at,
      clientId: r.client_id,
      clientName: client?.full_name ?? 'Cliente',
      clientPhone: client?.phone ?? null,
      vehicle: veh ? { brand: veh.brand, model: veh.model, year: veh.year } : null,
      description: r.service_id ? (serviceMap.get(r.service_id) ?? null) : null,
    };
  });

  return [...aidItems, ...apptItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getClientProfileForBusiness(
  clientId: string
): Promise<ClientProfileForBusiness | null> {
  const [{ data: user, error: userErr }, { data: vehicles, error: vehErr }] = await Promise.all([
    supabase.from('users').select('id, full_name, phone, avatar_url').eq('id', clientId).maybeSingle(),
    supabase.from('vehicles').select('id, brand, model, year, current_mileage').eq('user_id', clientId),
  ]);
  if (userErr) throw userErr;
  if (!user) return null;
  if (vehErr) throw vehErr;

  return {
    id: (user as any).id,
    full_name: (user as any).full_name,
    phone: (user as any).phone ?? null,
    avatar_url: (user as any).avatar_url ?? null,
    vehicles: (vehicles ?? []).map((v: any) => ({
      id: v.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      current_mileage: v.current_mileage,
    })),
  };
}
