import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NOTIFY_BUFFER_KM = 200;
const REMINDER_AFTER_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Vehicle {
  id: string;
  user_id: string;
  current_mileage: number;
  last_mileage_update: string;
  moto_type: string | null;
  avg_monthly_km: number | null;
  last_mileage_reminder_at: string | null;
}

interface MaintenanceRule {
  id: string;
  moto_type: string;
  service_name: string;
  interval_km: number | null;
}

interface MaintenanceSuggestion {
  id: string;
  vehicle_id: string;
  rule_id: string;
  due_at_km: number | null;
  status: 'pending' | 'notified' | 'dismissed' | 'completed';
  overdue_notified_at: string | null;
}

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  let pushCount = 0;

  const { data: vehiclesData, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('id, user_id, current_mileage, last_mileage_update, moto_type, avg_monthly_km, last_mileage_reminder_at');
  if (vehiclesError) {
    return new Response(JSON.stringify({ error: vehiclesError.message }), { status: 500 });
  }

  const { data: rulesData, error: rulesError } = await supabase
    .from('maintenance_rules')
    .select('id, moto_type, service_name, interval_km')
    .not('interval_km', 'is', null);
  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), { status: 500 });
  }

  const vehicles = (vehiclesData ?? []) as Vehicle[];
  const rules = (rulesData ?? []) as MaintenanceRule[];

  for (const vehicle of vehicles) {
    const { data: userRow } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', vehicle.user_id)
      .maybeSingle();
    const pushToken: string | null = userRow?.push_token ?? null;
    if (!pushToken) continue;

    const lastUpdate = new Date(vehicle.last_mileage_update);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / MS_PER_DAY;

    const lastReminder = vehicle.last_mileage_reminder_at ? new Date(vehicle.last_mileage_reminder_at) : null;
    const daysSinceReminder = lastReminder ? (now.getTime() - lastReminder.getTime()) / MS_PER_DAY : Infinity;

    if (daysSinceUpdate >= REMINDER_AFTER_DAYS && daysSinceReminder >= REMINDER_AFTER_DAYS) {
      await sendPush(
        pushToken,
        'Actualiza tu kilometraje',
        '¿Cuánto llevas rodando? Actualízalo para que te avisemos a tiempo de tu próximo mantenimiento.',
        { type: 'update_mileage', vehicleId: vehicle.id }
      );
      await supabase
        .from('vehicles')
        .update({ last_mileage_reminder_at: now.toISOString() })
        .eq('id', vehicle.id);
      pushCount++;
    }

    if (!vehicle.moto_type) continue;

    const dailyRate = vehicle.avg_monthly_km ? vehicle.avg_monthly_km / 30 : 0;
    const estimatedMileage = vehicle.current_mileage + dailyRate * Math.max(daysSinceUpdate, 0);
    if (dailyRate === 0) continue;

    const vehicleRules = rules.filter((r) => r.moto_type === vehicle.moto_type);

    for (const rule of vehicleRules) {
      const interval = rule.interval_km as number;

      const { data: suggestionsData } = await supabase
        .from('maintenance_suggestions')
        .select('id, vehicle_id, rule_id, due_at_km, status, overdue_notified_at')
        .eq('vehicle_id', vehicle.id)
        .eq('rule_id', rule.id)
        .neq('status', 'dismissed')
        .order('due_at_km', { ascending: false })
        .limit(1);

      let current = (suggestionsData?.[0] ?? null) as MaintenanceSuggestion | null;

      const needsNewCycle =
        !current || (current.status === 'completed' && estimatedMileage >= (current.due_at_km ?? 0));

      if (needsNewCycle) {
        const baseKm = current?.due_at_km ?? 0;
        const cyclesPassed = Math.floor(estimatedMileage / interval);
        const dueAtKm = Math.max(baseKm + interval, (cyclesPassed + 1) * interval);

        const { data: created } = await supabase
          .from('maintenance_suggestions')
          .insert({ vehicle_id: vehicle.id, rule_id: rule.id, due_at_km: dueAtKm, status: 'pending' })
          .select('id, vehicle_id, rule_id, due_at_km, status, overdue_notified_at')
          .single();
        current = created as MaintenanceSuggestion | null;
      }

      if (!current) continue;

      const kmRemaining = (current.due_at_km ?? 0) - estimatedMileage;

      if (current.status === 'pending' && kmRemaining > 0 && kmRemaining <= NOTIFY_BUFFER_KM) {
        await sendPush(
          pushToken,
          'Mantenimiento próximo',
          `${rule.service_name}: estimamos que te faltan ${Math.round(kmRemaining)} km. Confirma tu kilometraje real en la app.`,
          { type: 'maintenance_upcoming', vehicleId: vehicle.id, ruleId: rule.id }
        );
        await supabase.from('maintenance_suggestions').update({ status: 'notified' }).eq('id', current.id);
        pushCount++;
        continue;
      }

      if (kmRemaining <= 0 && current.status !== 'completed' && !current.overdue_notified_at) {
        await sendPush(
          pushToken,
          'Posible mantenimiento vencido',
          `Según tu kilometraje estimado, ya deberías haber hecho: ${rule.service_name}. Si todavía no lo hiciste, no lo dejes pasar.`,
          { type: 'maintenance_overdue', vehicleId: vehicle.id, ruleId: rule.id }
        );
        await supabase
          .from('maintenance_suggestions')
          .update({
            overdue_notified_at: now.toISOString(),
            status: current.status === 'pending' ? 'notified' : current.status,
          })
          .eq('id', current.id);
        pushCount++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, pushCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
