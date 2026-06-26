import { supabase } from './supabase';
import type { MaintenanceRule, MaintenanceSuggestion, Vehicle } from '../types/database';

export interface MaintenanceItem {
  suggestion: MaintenanceSuggestion;
  rule: MaintenanceRule;
  kmRemaining: number;
  isDue: boolean;
}

export async function getDueMaintenance(vehicle: Vehicle): Promise<MaintenanceItem[]> {
  if (!vehicle.moto_type) return [];

  const { data: rules, error: rulesError } = await supabase
    .from('maintenance_rules')
    .select('*')
    .eq('moto_type', vehicle.moto_type)
    .not('interval_km', 'is', null);
  if (rulesError) throw rulesError;

  const { data: suggestions, error: suggestionsError } = await supabase
    .from('maintenance_suggestions')
    .select('*')
    .eq('vehicle_id', vehicle.id)
    .neq('status', 'dismissed')
    .order('due_at_km', { ascending: false });
  if (suggestionsError) throw suggestionsError;

  const items: MaintenanceItem[] = [];

  for (const rule of (rules ?? []) as MaintenanceRule[]) {
    const interval = rule.interval_km as number;
    let current = (suggestions ?? []).find((s) => s.rule_id === rule.id) as
      | MaintenanceSuggestion
      | undefined;

    const needsNewCycle =
      !current || (current.status === 'completed' && vehicle.current_mileage >= (current.due_at_km ?? 0));

    if (needsNewCycle) {
      const baseKm = current?.due_at_km ?? 0;
      const cyclesPassed = Math.floor(vehicle.current_mileage / interval);
      const dueAtKm = Math.max(baseKm + interval, (cyclesPassed + 1) * interval);

      const { data: created, error: createError } = await supabase
        .from('maintenance_suggestions')
        .insert({ vehicle_id: vehicle.id, rule_id: rule.id, due_at_km: dueAtKm, status: 'pending' })
        .select()
        .single();
      if (createError) throw createError;
      current = created as MaintenanceSuggestion;
    }

    if (!current) continue;

    items.push({
      suggestion: current,
      rule,
      kmRemaining: (current.due_at_km ?? 0) - vehicle.current_mileage,
      isDue: vehicle.current_mileage >= (current.due_at_km ?? Infinity),
    });
  }

  return items.sort((a, b) => a.kmRemaining - b.kmRemaining);
}

export async function markCompleted(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_suggestions')
    .update({ status: 'completed' })
    .eq('id', suggestionId);
  if (error) throw error;
}
