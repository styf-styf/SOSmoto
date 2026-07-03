import { supabase } from './supabase';
import { getPlanLimits } from './catalog';
import { sendEmployeeInvitation } from './employeeInvitations';
import type { BusinessEmployee, EmployeeRemovalNotice } from '../types/database';

export interface EmployeeWithUser extends BusinessEmployee {
  user: { full_name: string; email: string; phone: string | null } | null;
}

export async function getEmployees(businessId: string): Promise<EmployeeWithUser[]> {
  const { data, error } = await supabase.rpc('get_business_employees', {
    target_business_id: businessId,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      business_id: row.business_id,
      user_id: row.user_id,
      role: row.role,
      can_accept_aid_requests: row.can_accept_aid_requests,
      created_at: row.created_at,
      user: { full_name: row.full_name, email: row.email, phone: row.phone },
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) as EmployeeWithUser[];
}

export async function addEmployeeByEmail(
  businessId: string,
  email: string,
  canAcceptAidRequests: boolean
): Promise<void> {
  const limits = await getPlanLimits(businessId);
  if (limits.maxEmployees !== null) {
    const current = await getEmployees(businessId);
    const allowedAdditional = limits.maxEmployees - 1;
    if (current.length >= allowedAdditional) {
      throw new Error(
        `Tu plan ${limits.planName} permite hasta ${limits.maxEmployees} personas en el negocio (incluyéndote a ti). Sube de plan para agregar más.`
      );
    }
  }

  const { data: userId, error: lookupError } = await supabase.rpc('find_user_id_by_email', {
    target_email: email.trim().toLowerCase(),
  });
  if (lookupError) throw lookupError;
  if (!userId) {
    throw new Error('No encontramos un usuario con ese correo. Debe registrarse en la app primero.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('business_employees')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    throw new Error('Esa persona ya es parte de tu equipo.');
  }

  await sendEmployeeInvitation(businessId, userId, canAcceptAidRequests);
}

export async function updateEmployeePermission(
  employeeId: string,
  canAcceptAidRequests: boolean
): Promise<void> {
  const { error } = await supabase
    .from('business_employees')
    .update({ can_accept_aid_requests: canAcceptAidRequests })
    .eq('id', employeeId);
  if (error) throw error;
}

export async function removeEmployee(employeeId: string): Promise<void> {
  // Leer antes de borrar para poder crear el aviso de remoción
  const { data: emp } = await supabase
    .from('business_employees')
    .select('user_id, business_id')
    .eq('id', employeeId)
    .single();

  const { error } = await supabase.from('business_employees').delete().eq('id', employeeId);
  if (error) throw error;

  // Fire-and-forget: el mecánico verá el aviso al reabrir la app
  if (emp?.user_id && emp?.business_id) {
    supabase
      .from('businesses')
      .select('name')
      .eq('id', emp.business_id)
      .single()
      .then(({ data: biz }) => {
        const businessName = biz?.name ?? 'el negocio';
        supabase
          .from('employee_removal_notices')
          .insert({ user_id: emp.user_id, business_name: businessName })
          .then(({ error: noticeError }) => {
            if (noticeError) console.error('removal notice insert error', noticeError);
          });
      });
  }
}

export async function getMyRemovalNotice(userId: string): Promise<EmployeeRemovalNotice | null> {
  const { data, error } = await supabase
    .from('employee_removal_notices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EmployeeRemovalNotice | null;
}

export async function dismissRemovalNotice(noticeId: string): Promise<void> {
  const { error } = await supabase.from('employee_removal_notices').delete().eq('id', noticeId);
  if (error) throw error;
}

export async function getMyEmployeeRecord(
  businessId: string,
  userId: string
): Promise<BusinessEmployee | null> {
  const { data, error } = await supabase
    .from('business_employees')
    .select('*')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessEmployee | null;
}
