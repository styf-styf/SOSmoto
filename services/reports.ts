import { supabase } from './supabase';
import type { ReportTargetType } from '../types/database';

// La tabla reports es nueva y angosta (reporter_id, target polimórfico,
// reason, status) -- se consulta sin tipar contra el Database genérico,
// mismo patrón que stock_movements/system_settings.
export async function createReport(reporterId: string, targetType: ReportTargetType, targetId: string, reason?: string): Promise<void> {
  const { error } = await (supabase.from('reports') as any).insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason: reason?.trim() || null,
  });
  if (error) throw error;
}
