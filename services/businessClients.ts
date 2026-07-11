import { supabase } from './supabase';
import { notifyUser } from './notifications';

export interface ExternalVehicle {
  brand: string;
  model: string;
  year: number;
  plate?: string;
}

export interface BusinessClientRecord {
  id: string;
  business_id: string;
  client_id: string | null;
  external_name: string | null;
  external_phone: string | null;
  external_email: string | null;
  vehicles: ExternalVehicle[];
  notes: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface PendingInvitation {
  id: string;
  businessId: string;
  businessName: string;
  businessLogo: string | null;
  businessCity: string | null;
  createdAt: string;
}

const bc = () => supabase.from('business_clients');

export async function addAppClient(
  businessId: string,
  clientId: string,
  businessName: string
): Promise<BusinessClientRecord> {
  const existing = await getBusinessClientByClientId(businessId, clientId);
  if (existing) return existing;

  let res = await bc()
    .insert({ business_id: businessId, client_id: clientId, status: 'pending' })
    .select()
    .single();
  // Fallback si la migración 0070 aún no está aplicada (columna status no existe)
  if (res.error?.code === 'PGRST204') {
    res = await bc()
      .insert({ business_id: businessId, client_id: clientId })
      .select()
      .single();
  }
  if (res.error) throw res.error;
  const { data, error } = res;

  notifyUser(
    clientId,
    `${businessName} quiere agregarte como cliente`,
    'Acepta o rechaza la solicitud en tu perfil → Invitaciones.',
    { type: 'business_invitation', businessId }
  ).catch(() => {});

  return data as BusinessClientRecord;
}

export async function respondToInvitation(
  recordId: string,
  accept: boolean
): Promise<void> {
  if (accept) {
    const { error } = await bc().update({ status: 'accepted' }).eq('id', recordId);
    if (error) throw error;
  } else {
    const { error } = await bc().delete().eq('id', recordId);
    if (error) throw error;
  }
}

export async function getPendingInvitations(
  clientId: string
): Promise<PendingInvitation[]> {
  const { data, error } = await bc()
    .select('id, business_id, created_at, businesses(id, name, logo_url, city)')
    .eq('client_id', clientId)
    .eq('status', 'pending');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r: any) => ({
    id: r.id,
    businessId: r.business_id,
    businessName: r.businesses?.name ?? 'Negocio',
    businessLogo: r.businesses?.logo_url ?? null,
    businessCity: r.businesses?.city ?? null,
    createdAt: r.created_at,
  }));
}

export interface AddExternalClientParams {
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  vehicles?: ExternalVehicle[];
  notes?: string;
}

export async function addExternalClient(
  params: AddExternalClientParams
): Promise<BusinessClientRecord> {
  const existing = await getBusinessClientByName(params.businessId, params.name);
  if (existing) {
    // Actualiza los datos si ya existe
    const { data, error } = await bc()
      .update({
        external_phone: params.phone?.trim() || existing.external_phone,
        external_email: params.email?.trim() || existing.external_email,
        vehicles: params.vehicles && params.vehicles.length > 0 ? params.vehicles : existing.vehicles,
        notes: params.notes?.trim() || existing.notes,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BusinessClientRecord;
  }

  const { data, error } = await bc()
    .insert({
      business_id: params.businessId,
      external_name: params.name.trim(),
      external_phone: params.phone?.trim() || null,
      external_email: params.email?.trim() || null,
      vehicles: params.vehicles ?? [],
      notes: params.notes?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BusinessClientRecord;
}

export async function getBusinessClientByClientId(
  businessId: string,
  clientId: string
): Promise<BusinessClientRecord | null> {
  const { data, error } = await bc()
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessClientRecord | null;
}

export async function getBusinessClientByName(
  businessId: string,
  name: string
): Promise<BusinessClientRecord | null> {
  const { data, error } = await bc()
    .select('*')
    .eq('business_id', businessId)
    .ilike('external_name', name.trim())
    .maybeSingle();
  if (error) throw error;
  return data as BusinessClientRecord | null;
}

export interface UpdateExternalClientParams {
  name?: string;
  phone?: string;
  email?: string;
  vehicles?: ExternalVehicle[];
  notes?: string;
}

export async function updateExternalClient(
  recordId: string,
  params: UpdateExternalClientParams
): Promise<BusinessClientRecord> {
  const update: {
    external_name?: string;
    external_phone?: string | null;
    external_email?: string | null;
    vehicles?: ExternalVehicle[];
    notes?: string | null;
  } = {};
  if (params.name !== undefined) update.external_name = params.name.trim();
  if (params.phone !== undefined) update.external_phone = params.phone.trim() || null;
  if (params.email !== undefined) update.external_email = params.email.trim() || null;
  if (params.vehicles !== undefined) update.vehicles = params.vehicles;
  if (params.notes !== undefined) update.notes = params.notes?.trim() || null;

  const { data, error } = await bc()
    .update(update)
    .eq('id', recordId)
    .select()
    .single();
  if (error) throw error;
  return data as BusinessClientRecord;
}

export async function isAppClientAdded(
  businessId: string,
  clientId: string
): Promise<boolean> {
  const { count } = await bc()
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('client_id', clientId);
  return (count ?? 0) > 0;
}
