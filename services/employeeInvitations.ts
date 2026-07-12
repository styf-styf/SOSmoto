import { supabase } from './supabase';
import { getPlanLimits } from './catalog';
import { notifyUser } from './notifications';
import type { EmployeePermissions } from './employees';
import type {
  EmployeeInvitation,
  EmployeeInvitationWithBusiness,
  EmployeeInvitationWithInvitee,
} from '../types/database';

export type { EmployeeInvitationWithBusiness, EmployeeInvitationWithInvitee };

export async function sendEmployeeInvitation(
  businessId: string,
  inviteeId: string,
  jobTitle: string | null,
  permissions: EmployeePermissions
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
    .insert({
      business_id: businessId,
      invitee_id: inviteeId,
      job_title: jobTitle,
      can_accept_aid_requests: permissions.canAcceptAidRequests,
      can_manage_catalog: permissions.canManageCatalog,
      can_reply_chat: permissions.canReplyChat,
      can_upload_stories: permissions.canUploadStories,
      can_create_posts: permissions.canCreatePosts,
    })
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
      'Invitación de equipo',
      `${business.name} te invitó a unirte como ${jobTitle ?? 'parte del equipo'}`,
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
    // El límite también se validó al enviar la invitación (sendEmployeeInvitation
    // pasa por addEmployeeByEmail), pero puede haber cambiado desde entonces
    // (otra persona se unió, o el negocio bajó de plan) -- se vuelve a validar acá.
    const limits = await getPlanLimits(inv.business_id);
    if (limits.maxEmployees !== null) {
      const { count } = await supabase
        .from('business_employees')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', inv.business_id);
      const allowedAdditional = limits.maxEmployees - 1;
      if ((count ?? 0) >= allowedAdditional) {
        throw new Error(
          `El negocio ya alcanzó el límite de personas de su plan (${limits.planName}, hasta ${limits.maxEmployees}). No se pudo aceptar la invitación.`
        );
      }
    }

    const { error: empError } = await supabase.from('business_employees').insert({
      business_id: inv.business_id,
      user_id: inv.invitee_id,
      role: 'mechanic',
      job_title: inv.job_title,
      can_accept_aid_requests: inv.can_accept_aid_requests,
      can_manage_catalog: inv.can_manage_catalog,
      can_reply_chat: inv.can_reply_chat,
      can_upload_stories: inv.can_upload_stories,
      can_create_posts: inv.can_create_posts,
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
      `${invitee?.full_name ?? 'La persona'} aceptó unirse a ${business.name ?? 'tu negocio'}`,
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
      `${invitee?.full_name ?? 'La persona'} rechazó la invitación para ${business.name ?? 'tu negocio'}`,
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
