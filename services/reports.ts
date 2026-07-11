import { supabase } from './supabase';
import type { ReportTargetType } from '../types/database';

export async function createReport(reporterId: string, targetType: ReportTargetType, targetId: string, reason?: string): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason: reason?.trim() || null,
  });
  if (error) throw error;
}
