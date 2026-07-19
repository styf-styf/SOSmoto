import { createAdminClient } from '../../../lib/supabase/admin';
import type {
  AdminAdPricingRow,
  AdminMaintenanceRuleRow,
  AdminSubscriptionPlanRow,
  AdminSystemSettingsRow,
} from '../../../lib/types';
import { AdPricingForm } from './AdPricingForm';
import { MaintenanceRuleCreateForm } from './MaintenanceRuleCreateForm';
import { MaintenanceRuleRow } from './MaintenanceRuleRow';
import { PlanEditForm } from './PlanEditForm';
import { SystemSettingsForm } from './SystemSettingsForm';

const planOrder = ['free', 'standard', 'pro'];

export default async function ConfiguracionPage() {
  const supabase = createAdminClient();

  const [plansResult, pricingResult, rulesResult, settingsResult] = await Promise.all([
    supabase.from('subscription_plans').select('*'),
    supabase
      .from('ad_pricing')
      .select('price_per_day_city, price_per_day_national, radius_reference_km, radius_cap_km')
      .single(),
    supabase.from('maintenance_rules').select('*').order('moto_type').order('interval_km'),
    supabase.from('system_settings').select('default_aid_radius_km').single(),
  ]);

  const plans = ((plansResult.data ?? []) as AdminSubscriptionPlanRow[]).sort(
    (a, b) => planOrder.indexOf(a.name) - planOrder.indexOf(b.name)
  );
  const pricing = pricingResult.data as AdminAdPricingRow | null;
  const rules = (rulesResult.data ?? []) as AdminMaintenanceRuleRow[];
  const settings = settingsResult.data as AdminSystemSettingsRow | null;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Configuración</h1>

      <h2 className="mb-3 text-lg font-semibold">Reglas del sistema</h2>
      {settingsResult.error && <p className="text-sm text-red-600">Error: {settingsResult.error.message}</p>}
      <div className="mb-10">{settings && <SystemSettingsForm settings={settings} />}</div>

      <h2 className="mb-3 text-lg font-semibold">Precios y límites de planes</h2>
      {plansResult.error && <p className="text-sm text-red-600">Error: {plansResult.error.message}</p>}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanEditForm key={plan.id} plan={plan} />
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Precio de publicidad</h2>
      {pricingResult.error && <p className="text-sm text-red-600">Error: {pricingResult.error.message}</p>}
      <div className="mb-10">{pricing && <AdPricingForm pricing={pricing} />}</div>

      <h2 className="mb-3 text-lg font-semibold">Reglas de sugerencias de mantenimiento</h2>
      <p className="mb-4 text-sm text-gray-500">
        Generan las sugerencias de mantenimiento del cliente según tipo de moto, kilometraje y tiempo transcurrido.
      </p>
      {rulesResult.error && <p className="text-sm text-red-600">Error: {rulesResult.error.message}</p>}

      <table className="mb-4 w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Tipo de moto</th>
            <th className="px-4 py-3">Servicio</th>
            <th className="px-4 py-3">Intervalo (km)</th>
            <th className="px-4 py-3">Intervalo (meses)</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <MaintenanceRuleRow key={rule.id} rule={rule} />
          ))}
          {rules.length === 0 && !rulesResult.error && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                No hay reglas de mantenimiento todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <MaintenanceRuleCreateForm />
    </div>
  );
}
