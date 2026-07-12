import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPlanPromotionRow, AdminPromotionBeneficiaryRow, PlanName } from '../../../lib/types';
import { PromotionToggleCard } from './PromotionToggleCard';
import { BeneficiaryExpiryEditor } from './BeneficiaryExpiryEditor';

const PLAN_LABELS: Record<PlanName, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

export default async function PromocionesPage() {
  const supabase = createAdminClient();

  const [plansResult, promotionsResult, beneficiariesResult] = await Promise.all([
    supabase.from('subscription_plans').select('id, name').in('name', ['standard', 'pro']),
    supabase
      .from('plan_promotions')
      .select('id, plan_id, duration_days, is_active, activated_at, created_at, subscription_plans(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('business_subscriptions')
      .select('id, business_id, plan_id, started_at, expires_at, businesses(name), subscription_plans(name)')
      .not('promotion_id', 'is', null)
      .order('expires_at', { ascending: true }),
  ]);

  const plans = (plansResult.data ?? []) as { id: string; name: PlanName }[];
  const promotions = (promotionsResult.data ?? []) as unknown as AdminPlanPromotionRow[];
  const beneficiaries = (beneficiariesResult.data ?? []) as unknown as AdminPromotionBeneficiaryRow[];

  const activePromotion = promotions.find((p) => p.is_active) ?? null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Promociones</h1>
      <p className="mb-6 text-sm text-gray-500">
        Regala un plan pago por tiempo limitado a los negocios que se registren mientras la oferta esté activa. Solo
        puede haber una promoción activa a la vez, y cada negocio puede reclamar una única vez en toda su historia.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const isActive = activePromotion?.plan_id === plan.id;
          const lastForPlan = promotions.find((p) => p.plan_id === plan.id);
          return (
            <PromotionToggleCard
              key={plan.id}
              planId={plan.id}
              planName={plan.name}
              isActive={isActive}
              otherPlanIsActive={!!activePromotion && !isActive}
              defaultDurationDays={isActive ? activePromotion!.duration_days : lastForPlan?.duration_days ?? null}
            />
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Negocios con beneficio de promoción</h2>
      {(plansResult.error || promotionsResult.error || beneficiariesResult.error) && (
        <p className="mb-3 text-sm text-red-600">
          Error: {plansResult.error?.message ?? promotionsResult.error?.message ?? beneficiariesResult.error?.message}
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
