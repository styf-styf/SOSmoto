import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPlanPromotionRow, AdminPromotionBeneficiaryRow, BusinessType, PlanName } from '../../../lib/types';
import { PromotionToggleCard } from './PromotionToggleCard';
import { PromotionScopeToggle } from './PromotionScopeToggle';
import { AssignPlanForm } from './AssignPlanForm';
import { BeneficiaryExpiryEditor } from './BeneficiaryExpiryEditor';

const PLAN_LABELS: Record<PlanName, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };
const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = { workshop: 'Taller', store: 'Tienda', brand_advertiser: 'Marca' };
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
    supabase.from('subscription_plans').select('id, name, business_type').in('name', ['standard', 'pro']),
    supabase
      .from('plan_promotions')
      .select('id, plan_id, duration_days, remaining_days, is_active, activated_at, created_at, subscription_plans(name, business_type)'),
    supabase
      .from('business_subscriptions')
      .select('id, business_id, plan_id, started_at, expires_at, businesses(name), subscription_plans(name)')
      .not('promotion_id', 'is', null)
      .eq('status', 'active')
      .order('expires_at', { ascending: true }),
    supabase.from('promotion_settings').select('applies_to_all_businesses').eq('id', true).maybeSingle(),
  ]);

  // Orden fijo para que la grilla (2 columnas) quede como en la app: columna
  // izquierda = Taller (Estándar arriba, Pro abajo), columna derecha =
  // Tienda (Estándar arriba, Pro abajo). El grid de abajo es de 1 fila por
  // nivel (Estándar, luego Pro), con taller y tienda lado a lado en esa
  // fila -- así el orden de lectura por fila coincide con las columnas
  // visuales. Antes dependía del orden de inserción en la base, que no
  // coincidía con esto y se prestaba a confusión.
  const BUSINESS_TYPE_ORDER: Record<BusinessType, number> = { workshop: 0, store: 1, brand_advertiser: 2 };
  const PLAN_ORDER: Record<PlanName, number> = { free: 0, standard: 1, pro: 2 };
  const plans = ((plansResult.data ?? []) as { id: string; name: PlanName; business_type: BusinessType }[]).sort(
    (a, b) => PLAN_ORDER[a.name] - PLAN_ORDER[b.name] || BUSINESS_TYPE_ORDER[a.business_type] - BUSINESS_TYPE_ORDER[b.business_type]
  );
  const promotions = (promotionsResult.data ?? []) as unknown as AdminPlanPromotionRow[];
  const beneficiaries = (beneficiariesResult.data ?? []) as unknown as AdminPromotionBeneficiaryRow[];
  const appliesToAll = !!(settingsResult.data as { applies_to_all_businesses: boolean } | null)?.applies_to_all_businesses;

  // Taller y Tienda son independientes entre si -- taller Estándar y tienda
  // Pro (por ejemplo) pueden estar activos al mismo tiempo. Lo que nunca
  // puede coexistir es Estándar y Pro activos DEL MISMO business_type, así
  // que el nivel "corriendo ahora mismo" se calcula por separado para cada
  // tipo de negocio.
  const activePlanNameByType = (Object.fromEntries(
    (['workshop', 'store'] as BusinessType[]).map((type) => [
      type,
      promotions.find((p) => p.is_active && p.subscription_plans?.business_type === type)?.subscription_plans?.name ?? null,
    ])
  ) as Record<BusinessType, PlanName | null>);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Promociones</h1>
      <p className="mb-6 text-sm text-gray-500">
        Regala un plan pago por tiempo limitado a los negocios que se registren mientras la oferta esté activa.
        Taller y Tienda son independientes -- pueden tener niveles distintos activos a la vez (ej. taller Estándar
        + tienda Pro), pero dentro de un mismo tipo de negocio no pueden coexistir Estándar y Pro simultáneamente.
        Cada negocio puede reclamar una única vez en toda su historia.
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
              businessTypeLabel={BUSINESS_TYPE_LABELS[plan.business_type] ?? plan.business_type}
              isActive={isActive}
              otherPlanIsActive={
                !!activePlanNameByType[plan.business_type] &&
                activePlanNameByType[plan.business_type] !== plan.name &&
                !isActive
              }
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
