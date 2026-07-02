import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type {
  EmployeeInvitation,
  EmployeeInvitationWithBusiness,
  EmployeeInvitationWithInvitee,
} from '../types/database';

export type { EmployeeInvitationWithBusiness, EmployeeInvitationWithInvitee };

export async function sendEmployeeInvitation(
  businessId: string,
  inviteeId: string,
  canAcceptAidRequests: boolean
): Promise<EmployeeInvitation> {
  const { data: existing } = await supabase
    .from('employee_invitations')
    .select('id')
    .eq('business_id', businessId)
    .eq('invitee_id', inviteeId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) throw new Error('Ya existe una invitación pendiente para esa persona.');

  const { data, error } = await supabase
    .from('employee_invitations')
    .insert({ business_id: businessId, invitee_id: inviteeId, can_accept_aid_requests: canAcceptAidRequests })
    .select()
    .single();
  if (error) throw error;

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle();
  if (business?.name) {
    await notifyUser(
      inviteeId,
      'Invitación de taller',
      `${business.name} te invitó a unirte como mecánico`,
      { type: 'employee_invitation', invitationId: data.id, businessId }
    );
  }

  return data as EmployeeInvitation;
}

export async function getMyPendingInvitations(
  userId: string
): Promise<EmployeeInvitationWithBusiness[]> {
  const { data, error } = await supabase
    .from('employee_invitations')
    .select('*, businesses(name, logo_url)')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (EmployeeInvitation & {
      businesses: { name: string; logo_url: string | null } | null;
    })[]
  ).map((row) => ({
    ...row,
    business_name: row.businesses?.name ?? 'Negocio',
    business_logo_url: row.businesses?.logo_url ?? null,
  }));
}

export async function getPendingInvitationsForBusiness(
  businessId: string
): Promise<EmployeeInvitationWithInvitee[]> {
  const { data, error } = await supabase
    .from('employee_invitations')
    .select('*, users!employee_invitations_invitee_id_fkey(full_name, email)')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (EmployeeInvitation & {
      users: { full_name: string; email: string } | null;
    })[]
  ).map((row) => ({
    ...row,
    invitee_name: row.users?.full_name ?? 'Usuario',
    invitee_email: row.users?.email ?? '',
  }));
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  const { data: inv, error: fetchError } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();
  if (fetchError) throw fetchError;

  const { data: existing } = await supabase
    .from('business_employees')
    .select('id')
    .eq('business_id', inv.business_id)
    .eq('user_id', inv.invitee_id)
    .maybeSingle();

  if (!existing) {
    const { error: empError } = await supabase.from('business_employees').insert({
      business_id: inv.business_id,
      user_id: inv.invitee_id,
      role: 'mechanic',
      can_accept_aid_requests: inv.can_accept_aid_requests,
    });
    if (empError) throw empError;
  }

  const { error } = await supabase
    .from('employee_invitations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', invitationId);
  if (error) throw error;

  const [{ data: business }, { data: invitee }] = await Promise.all([
    supabase.from('businesses').select('owner_id, name').eq('id', inv.business_id).maybeSingle(),
    supabase.from('users').select('full_name').eq('id', inv.invitee_id).maybeSingle(),
  ]);
  if (business?.owner_id) {
    await notifyUser(
      business.owner_id,
      'Invitación aceptada',
      `${invitee?.full_name ?? 'El mecánico'} aceptó unirse a ${business.name ?? 'tu taller'}`,
      { type: 'employee_invitation_accepted', businessId: inv.business_id }
    );
  }
}

export async function rejectInvitation(invitationId: string): Promise<void> {
  const { data: inv, error: fetchError } = await supabase
    .from('employee_invitations')
    .select('business_id, invitee_id')
    .eq('id', invitationId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('employee_invitations')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', invitationId);
  if (error) throw error;

  const [{ data: business }, { data: invitee }] = await Promise.all([
    supabase.from('businesses').select('owner_id, name').eq('id', inv.business_id).maybeSingle(),
    supabase.from('users').select('full_name').eq('id', inv.invitee_id).maybeSingle(),
  ]);
  if (business?.owner_id) {
    await notifyUser(
      business.owner_id,
      'Invitación rechazada',
      `${invitee?.full_name ?? 'El mecánico'} rechazó la invitación para ${business.name ?? 'tu taller'}`,
      { type: 'employee_invitation_rejected', businessId: inv.business_id }
    );
  }
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('employee_invitations')
    .delete()
    .eq('id', invitationId);
  if (error) throw error;
}
