import { supabase } from './supabase';

export interface ClientMaintenanceItem {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  vehicleId: string;
  vehicleLabel: string;
  vehicleMileage: number;
  serviceName: string;
  kmRemaining: number;
  isDue: boolean;
  suggestionId: string;
}

export async function getClientsWithUpcomingMaintenance(
  businessId: string
): Promise<ClientMaintenanceItem[]> {
  const [{ data: aids }, { data: appts }] = await Promise.all([
    supabase
      .from('help_requests')
      .select('client_id')
      .eq('accepted_business_id', businessId)
      .eq('status', 'completed'),
    supabase
      .from('appointments')
      .select('client_id')
      .eq('business_id', businessId)
      .eq('status', 'completed'),
  ]);

  const clientIds = Array.from(
    new Set([
      ...(aids ?? []).map((r: any) => r.client_id as string),
      ...(appts ?? []).map((r: any) => r.client_id as string),
    ])
  );
  if (clientIds.length === 0) return [];

  const [{ data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('users').select('id, full_name, phone').in('id', clientIds),
    supabase.from('vehicles').select('id, user_id, brand, model, current_mileage').in('user_id', clientIds),
  ]);

  if (!vehicles || vehicles.length === 0) return [];

  const vehicleIds = (vehicles as any[]).map((v) => v.id as string);

  const { data: suggestions } = await supabase
    .from('maintenance_suggestions')
    .select('id, vehicle_id, rule_id, due_at_km, status')
    .in('vehicle_id', vehicleIds)
    .in('status', ['pending', 'notified']);

  if (!suggestions || suggestions.length === 0) return [];

  const ruleIds = Array.from(new Set((suggestions as any[]).map((s) => s.rule_id as string)));
  const { data: rules } = await supabase
    .from('maintenance_rules')
    .select('id, service_name')
    .in('id', ruleIds);

  const clientById = new Map((clients ?? []).map((c: any) => [c.id as string, c]));
  const vehicleById = new Map((vehicles as any[]).map((v) => [v.id as string, v]));
  const ruleById = new Map((rules ?? []).map((r: any) => [r.id as string, r]));

  const results: ClientMaintenanceItem[] = [];

  for (const s of suggestions as any[]) {
    const vehicle = vehicleById.get(s.vehicle_id);
    if (!vehicle) continue;
    const rule = ruleById.get(s.rule_id);
    if (!rule) continue;
    const client = clientById.get(vehicle.user_id);
    if (!client) continue;

    const kmRemaining = (s.due_at_km ?? 0) - vehicle.current_mileage;
    const isDue = kmRemaining <= 0;
    const isNearDue = kmRemaining <= 500;

    if (!isDue && !isNearDue && s.status !== 'notified') continue;

    results.push({
      clientId: client.id,
      clientName: client.full_name,
      clientPhone: client.phone ?? null,
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.brand} ${vehicle.model}`,
      vehicleMileage: vehicle.current_mileage,
      serviceName: rule.service_name,
      kmRemaining,
      isDue,
      suggestionId: s.id,
    });
  }

  return results.sort((a, b) => a.kmRemaining - b.kmRemaining);
}
