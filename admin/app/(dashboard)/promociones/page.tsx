import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPlanPromotionRow, AdminPromotionBeneficiaryRow, PlanName } from '../../../lib/types';
import { PromotionToggleCard } from './PromotionToggleCard';
import { PromotionScopeToggle } from './PromotionScopeToggle';
import { AssignPlanForm } from './AssignPlanForm';
import { BeneficiaryExpiryEditor } from './BeneficiaryExpiryEditor';

const PLAN_LABELS: Record<PlanName, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Mientras está activa, remaining_days sigue "de referencia" desde
// activated_at -- acá se calcula cuánto queda en este momento. Pausada, el
// número guardado ya es el saldo congelado.
function liveRemainingDays(promo: AdminPlanPromotionRow | undefined): number {
  if (!promo) return 0;
  if (!promo.is_active || !promo.activated_at) return Math.max(0, Math.round(promo.remaining_days));
  const elapsedDays = (Date.now() - new Date(promo.activated_at).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.round(promo.remaining_days - elapsedDays));
}

export default async function PromocionesPage() {
  const supabase = createAdminClient();

  const [plansResult, promotionsResult, beneficiariesResult, settingsResult] = await Promise.all([
    supabase.from('subscription_plans').select('id, name').in('name', ['standard', 'pro']),
    supabase
      .from('plan_promotions')
      .select('id, plan_id, duration_days, remaining_days, is_active, activated_at, created_at, subscription_plans(name)'),
    supabase
      .from('business_subscriptions')
      .select('id, business_id, plan_id, started_at, expires_at, businesses(name), subscription_plans(name)')
      .not('promotion_id', 'is', null)
      .order('expires_at', { ascending: true }),
    supabase.from('promotion_settings').select('applies_to_all_businesses').eq('id', true).maybeSingle(),
  ]);

  const plans = (plansResult.data ?? []) as { id: string; name: PlanName }[];
  const promotions = (promotionsResult.data ?? []) as unknown as AdminPlanPromotionRow[];
  const beneficiaries = (beneficiariesResult.data ?? []) as unknown as AdminPromotionBeneficiaryRow[];
  const appliesToAll = !!(settingsResult.data as { applies_to_all_businesses: boolean } | null)?.applies_to_all_businesses;

  const activePromotion = promotions.find((p) => p.is_active) ?? null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Promociones</h1>
      <p className="mb-6 text-sm text-gray-500">
        Regala un plan pago por tiempo limitado a los negocios que se registren mientras la oferta esté activa. Solo
        puede haber una promoción activa a la vez, y cada negocio puede reclamar una única vez en toda su historia.
      </p>

      <PromotionScopeToggle appliesToAll={appliesToAll} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const promo = promotions.find((p) => p.plan_id === plan.id);
          const isActive = !!promo?.is_active;
          return (
            <PromotionToggleCard
              key={plan.id}
              planId={plan.id}
              planName={plan.name}
              isActive={isActive}
              otherPlanIsActive={!!activePromotion && !isActive}
              durationDays={promo?.duration_days ?? null}
              remainingDays={promo ? liveRemainingDays(promo) : null}
            />
          );
        })}
      </div>

      <AssignPlanForm plans={plans} />

      <h2 className="mb-3 text-lg font-semibold">Negocios con beneficio de promoción</h2>
      {(plansResult.error || promotionsResult.error || beneficiariesResult.error || settingsResult.error) && (
        <p className="mb-3 text-sm text-red-600">
          Error:{' '}
          {plansResult.error?.message ??
            promotionsResult.error?.message ??
            beneficiariesResult.error?.message ??
            settingsResult.error?.message}
        </p>
      )}

      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Negocio</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Otorgado</th>
            <th className="px-4 py-3">Fecha de corte</th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{row.businesses?.name ?? '—'}</td>
              <td className="px-4 py-3">{PLAN_LABELS[row.subscription_plans?.name as PlanName] ?? '—'}</td>
              <td className="px-4 py-3">{new Date(row.started_at).toLocaleDateString('es-EC')}</td>
              <td className="px-4 py-3">
                <BeneficiaryExpiryEditor subscriptionId={row.id} expiresAt={row.expires_at} />
              </td>
            </tr>
          ))}
          {beneficiaries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                Todavía ningún negocio ha reclamado una promoción.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
