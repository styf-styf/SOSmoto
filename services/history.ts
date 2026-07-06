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
  email: string | null;
  avatar_url: string | null;
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
    .select('id, client_id, vehicle_id, service_id, requested_at')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('requested_at', { ascending: false })
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
      date: r.requested_at ?? r.created_at,
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

export interface CRMClient {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  last_visit: string;
  total_visits: number;
  is_external?: boolean;
  status?: 'pending' | 'accepted' | 'rejected';
  crm_record_id?: string;
}

export async function getCRMClients(businessId: string): Promise<CRMClient[]> {
  // Paso 1: clientes explícitamente agregados al taller
  const { data: bizClients } = await (supabase.from('business_clients') as any)
    .select('id, client_id, external_name, external_phone, created_at')
    .eq('business_id', businessId);

  // status es una columna nueva (migración 0070) — query separada para no romper
  // la lista principal si la migración aún no está aplicada.
  const statusMap = new Map<string, 'pending' | 'accepted' | 'rejected'>();
  const { data: statusRows } = await (supabase.from('business_clients') as any)
    .select('id, status')
    .eq('business_id', businessId);
  for (const r of (statusRows ?? []) as any[]) {
    statusMap.set(r.id as string, r.status ?? 'accepted');
  }

  // Paso 2: resumen de visitas reales (citas completadas + auxilios)
  const [{ data: aids }, { data: apts }, { data: extApts }, { data: extReports }] = await Promise.all([
    supabase
      .from('help_requests')
      .select('client_id, completed_at, created_at')
      .eq('accepted_business_id', businessId)
      .eq('status', 'completed'),
    supabase
      .from('appointments')
      .select('client_id, requested_at')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('client_id', 'is', null),
    (supabase.from('appointments') as any)
      .select('external_client_name, requested_at')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .is('client_id', null)
      .not('external_client_name', 'is', null),
    (supabase.from('service_reports') as any)
      .select('external_client_name, created_at')
      .eq('business_id', businessId)
      .is('client_id', null)
      .not('external_client_name', 'is', null),
  ]);

  // Mapa de visitas por client_id
  const appVisits = new Map<string, { lastVisit: string; total: number }>();
  for (const r of (aids ?? []) as any[]) {
    const date: string = r.completed_at ?? r.created_at;
    const prev = appVisits.get(r.client_id);
    appVisits.set(r.client_id, {
      lastVisit: prev ? (date > prev.lastVisit ? date : prev.lastVisit) : date,
      total: (prev?.total ?? 0) + 1,
    });
  }
  for (const r of (apts ?? []) as any[]) {
    if (!r.client_id || !r.requested_at) continue;
    const prev = appVisits.get(r.client_id);
    appVisits.set(r.client_id, {
      lastVisit: prev ? (r.requested_at > prev.lastVisit ? r.requested_at : prev.lastVisit) : r.requested_at,
      total: (prev?.total ?? 0) + 1,
    });
  }

  // Mapa de visitas por nombre externo (lowercase)
  const extVisits = new Map<string, { lastVisit: string; total: number }>();
  for (const r of (extApts ?? []) as any[]) {
    if (!r.external_client_name || !r.requested_at) continue;
    const key = r.external_client_name.toLowerCase();
    const prev = extVisits.get(key);
    extVisits.set(key, {
      lastVisit: prev ? (r.requested_at > prev.lastVisit ? r.requested_at : prev.lastVisit) : r.requested_at,
      total: (prev?.total ?? 0) + 1,
    });
  }
  for (const r of (extReports ?? []) as any[]) {
    if (!r.external_client_name) continue;
    const key = r.external_client_name.toLowerCase();
    const prev = extVisits.get(key);
    extVisits.set(key, {
      lastVisit: prev ? (r.created_at > prev.lastVisit ? r.created_at : prev.lastVisit) : r.created_at,
      total: (prev?.total ?? 0) + 1,
    });
  }

  // Paso 3: construir lista desde business_clients (incluye clientes con 0 visitas)
  const addedAppIds = new Set<string>();
  const addedExtNames = new Set<string>();
  const results: CRMClient[] = [];

  const appIdsToFetch = (bizClients ?? [])
    .filter((c: any) => c.client_id)
    .map((c: any) => c.client_id as string);

  let userMap = new Map<string, any>();
  if (appIdsToFetch.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, phone, avatar_url')
      .in('id', appIdsToFetch);
    userMap = new Map((users ?? []).map((u: any) => [u.id, u]));
  }

  for (const bc of (bizClients ?? []) as any[]) {
    if (bc.client_id) {
      addedAppIds.add(bc.client_id);
      const u = userMap.get(bc.client_id);
      if (!u) continue;
      const status: 'pending' | 'accepted' | 'rejected' = statusMap.get(bc.id) ?? 'accepted';
      const visits = status === 'accepted' ? appVisits.get(bc.client_id) : undefined;
      results.push({
        id: bc.client_id,
        full_name: u.full_name,
        phone: status === 'pending' ? null : (u.phone ?? null),
        avatar_url: status === 'pending' ? null : (u.avatar_url ?? null),
        last_visit: visits?.lastVisit ?? bc.created_at,
        total_visits: visits?.total ?? 0,
        is_external: false,
        status,
        crm_record_id: bc.id,
      });
    } else if (bc.external_name) {
      const key = bc.external_name.toLowerCase();
      addedExtNames.add(key);
      const visits = extVisits.get(key);
      results.push({
        id: `ext:${encodeURIComponent(bc.external_name)}`,
        full_name: bc.external_name,
        phone: bc.external_phone ?? null,
        avatar_url: null,
        last_visit: visits?.lastVisit ?? bc.created_at,
        total_visits: visits?.total ?? 0,
        is_external: true,
      });
    }
  }

  // Paso 4: agregar clientes históricos no registrados explícitamente
  const historicalAppIds = [...appVisits.keys()].filter((id) => !addedAppIds.has(id));
  if (historicalAppIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, phone, avatar_url')
      .in('id', historicalAppIds);
    for (const u of (users ?? []) as any[]) {
      const visits = appVisits.get(u.id)!;
      results.push({
        id: u.id,
        full_name: u.full_name,
        phone: u.phone ?? null,
        avatar_url: u.avatar_url ?? null,
        last_visit: visits.lastVisit,
        total_visits: visits.total,
        is_external: false,
      });
    }
  }

  for (const [key, visits] of extVisits.entries()) {
    if (addedExtNames.has(key)) continue;
    // Recuperar nombre original desde las citas
    const aptRow = (extApts ?? []).find((r: any) => r.external_client_name?.toLowerCase() === key);
    const name = (aptRow as any)?.external_client_name ?? key;
    results.push({
      id: `ext:${encodeURIComponent(name)}`,
      full_name: name,
      phone: null,
      avatar_url: null,
      last_visit: visits.lastVisit,
      total_visits: visits.total,
      is_external: true,
    });
  }

  return results.sort((a, b) => new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime());
}

export interface ExternalClientData {
  appointments: { id: string; requested_at: string | null; status: string; service_name: string | null; notes: string | null }[];
  reports: { id: string; created_at: string; vehicle_label: string | null; service_category: string | null; appointment_id: string | null; status: 'draft' | 'sent' }[];
}

export async function getExternalClientData(
  businessId: string,
  name: string
): Promise<ExternalClientData> {
  const [{ data: apts }, { data: rpts }] = await Promise.all([
    (supabase.from('appointments') as any)
      .select('id, requested_at, status, notes, services(name)')
      .eq('business_id', businessId)
      .eq('external_client_name', name)
      .is('client_id', null)
      .order('requested_at', { ascending: false }),
    (supabase.from('service_reports') as any)
      .select('id, created_at, vehicle_label, service_category, appointment_id, status')
      .eq('business_id', businessId)
      .eq('external_client_name', name)
      .is('client_id', null)
      .order('created_at', { ascending: false }),
  ]);

  return {
    appointments: (apts ?? []).map((r: any) => ({
      id: r.id,
      requested_at: r.requested_at ?? null,
      status: r.status,
      service_name: r.services?.name ?? null,
      notes: r.notes ?? null,
    })),
    reports: (rpts ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      vehicle_label: r.vehicle_label ?? null,
      service_category: r.service_category ?? null,
      appointment_id: r.appointment_id ?? null,
      status: (r.status ?? 'sent') as 'draft' | 'sent',
    })),
  };
}

export interface UserSearchResult {
  id: string;
  full_name: string;
  phone: string | null;
}

export async function searchUsers(
  query: string,
  excludeIds: string[] = []
): Promise<UserSearchResult[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone')
    .eq('role', 'client')
    .ilike('full_name', `%${query.trim()}%`)
    .limit(8);
  if (error) throw error;
  const results = (data ?? []) as UserSearchResult[];
  if (excludeIds.length === 0) return results;
  return results.filter((u) => !excludeIds.includes(u.id));
}

export async function getClientProfileForBusiness(
  clientId: string
): Promise<ClientProfileForBusiness | null> {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, full_name, phone, email, avatar_url')
    .eq('id', clientId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user) return null;

  return {
    id: (user as any).id,
    full_name: (user as any).full_name,
    phone: (user as any).phone ?? null,
    email: (user as any).email ?? null,
    avatar_url: (user as any).avatar_url ?? null,
  };
}
