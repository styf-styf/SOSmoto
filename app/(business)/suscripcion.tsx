import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness, getSubscriptionPlans, updateBusinessPlan } from '../../services/businesses';
import { getAllProducts, getAllServices } from '../../services/catalog';
import { getEmployees } from '../../services/employees';
import { getActiveSubscription, getWebLoginCode } from '../../services/payments';
import type { Business, SubscriptionPlan } from '../../types/database';

const SUBSCRIPTION_PORTAL_URL = 'https://so-smoto.vercel.app/api/suscripcion';
// Mismo umbral que el aviso push de check-subscription-expiry -- así el botón
// de renovar aparece justo cuando le llega esa notificación al dueño.
const REMINDER_DAYS_BEFORE = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const planLabel: Record<string, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

const dashboardTierLabel: Record<string, string> = {
  free: 'Básico',
  standard: 'Intermedio',
  pro: 'Avanzado',
};

function limitLabel(value: number | null): string {
  return value === null ? 'Ilimitado' : String(value);
}

interface SuscripcionData {
  business: Business | null;
  isOwner: boolean;
  plans: SubscriptionPlan[];
  usage: { services: number; products: number; employees: number };
  expiresAt: string | null;
}

export default function SuscripcionScreen() {
  const { profile } = useAuth();
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `suscripcion-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<SuscripcionData>(cacheKey, async () => {
    const empty: SuscripcionData = {
      business: null,
      isOwner: false,
      plans: [],
      usage: { services: 0, products: 0, employees: 0 },
      expiresAt: null,
    };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;

    const [allPlans, services, products, employees, activeSub] = await Promise.all([
      getSubscriptionPlans(),
      getAllServices(work.business.id),
      getAllProducts(work.business.id),
      getEmployees(work.business.id),
      getActiveSubscription(work.business.id),
    ]);
    return {
      business: work.business,
      isOwner: work.isOwner,
      plans: allPlans,
      usage: {
        services: services.filter((s) => s.is_active).length,
        products: products.filter((p) => p.is_active).length,
        employees: employees.length + 1,
      },
      expiresAt: activeSub?.expires_at ?? null,
    };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;
  const plans = data?.plans ?? [];
  const usage = data?.usage ?? { services: 0, products: 0, employees: 0 };
  const expiresAt = data?.expiresAt ?? null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load suscripcion error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function openPortal(planId: string) {
    try {
      const code = await getWebLoginCode();
      await Linking.openURL(`${SUBSCRIPTION_PORTAL_URL}?code=${code}&planId=${planId}`);
    } catch (err) {
      console.error('open portal error', err);
      // Si no se pudo generar el código de auto-login, igual lo dejamos
      // entrar y que se loguee a mano en el portal (ya con el plan preseleccionado).
      Linking.openURL(`${SUBSCRIPTION_PORTAL_URL}?planId=${planId}`).catch(() =>
        Alert.alert('Error', 'No se pudo abrir el portal de pagos.')
      );
    }
  }

  async function handleSwitch(plan: SubscriptionPlan) {
    if (!business) return;

    const expiresAtLabel = expiresAt ? new Date(expiresAt).toLocaleDateString('es-EC') : null;
    const isRenewal = plan.id === business.plan_id;

    if (plan.price_monthly > 0) {
      const lines = [
        `Pagarás $${plan.price_monthly.toFixed(2)}/mes vía Payphone.`,
        'El plan se activa de inmediato en cuanto se confirme el pago.',
      ];
      if (expiresAtLabel) {
        lines.push(
          isRenewal
            ? `Tu nueva fecha de vencimiento será 1 mes a partir de hoy; los días que te quedaban del plan actual (vencía el ${expiresAtLabel}) no se acumulan.`
            : `Esto reemplaza tu plan actual (vencía el ${expiresAtLabel}); los días que te quedaban no se prorratean ni se reembolsan.`
        );
      }

      Alert.alert(isRenewal ? `Renovar plan ${planLabel[plan.name] ?? plan.name}` : `Obtener plan ${planLabel[plan.name] ?? plan.name}`, lines.join('\n\n'), [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar al pago',
          onPress: async () => {
            setSwitching(plan.id);
            try {
              await openPortal(plan.id);
            } finally {
              setSwitching(null);
            }
          },
        },
      ]);
      return;
    }

    const warnings: string[] = [];
    if (plan.max_services !== null && usage.services > plan.max_services) {
      warnings.push(`tienes ${usage.services} servicios activos (el plan permite ${plan.max_services})`);
    }
    if (plan.max_products !== null && usage.products > plan.max_products) {
      warnings.push(`tienes ${usage.products} productos activos (el plan permite ${plan.max_products})`);
    }
    if (plan.max_employees !== null && usage.employees > plan.max_employees) {
      warnings.push(`tienes ${usage.employees} personas en el equipo (el plan permite ${plan.max_employees})`);
    }

    const lines: string[] = [];
    if (warnings.length > 0) {
      lines.push(
        `Al cambiarte a ${planLabel[plan.name]}, ${warnings.join('; ')}. No se eliminará nada, pero no podrás agregar más hasta bajar de esos números.`
      );
    }
    if (expiresAtLabel) {
      lines.push(
        `Perderás el plan pago que tienes activo (vencía el ${expiresAtLabel}); los días que te quedaban no se reembolsan.`
      );
    }

    const proceed = () => doSwitch(plan.id);

    if (lines.length > 0) {
      Alert.alert(`Cambiar a plan ${planLabel[plan.name]}`, lines.join('\n\n'), [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cambiar de todas formas', onPress: proceed },
      ]);
    } else {
      proceed();
    }
  }

  async function doSwitch(planId: string) {
    if (!business) return;
    setSwitching(planId);
    try {
      const updated = await updateBusinessPlan(business.id, planId);
      setData((prev) => (prev ? { ...prev, business: updated } : prev));
      Alert.alert('Listo', 'Tu plan se actualizó.');
    } catch (err) {
      console.error('update plan error', err);
      Alert.alert('Error', 'No se pudo cambiar de plan.');
    } finally {
      setSwitching(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea o únete a un negocio.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Text style={styles.helperText}>
        Los planes pagos se cobran y se gestionan desde el portal web de SOSmoto (Payphone). Te avisaremos antes de
        que venza tu suscripción para que renueves.
      </Text>
      {expiresAt && (
        <Text style={styles.helperText}>
          Tu plan actual vence el {new Date(expiresAt).toLocaleDateString('es-EC')}.
        </Text>
      )}

      {plans.map((plan) => {
        const isCurrent = plan.id === business.plan_id;
        const daysLeft = expiresAt ? (new Date(expiresAt).getTime() - Date.now()) / MS_PER_DAY : null;
        const canRenewSoon =
          isCurrent && plan.price_monthly > 0 && daysLeft !== null && daysLeft <= REMINDER_DAYS_BEFORE;
        const features = [
          { label: `Productos: ${limitLabel(plan.max_products)}`, available: true },
          { label: `Servicios: ${limitLabel(plan.max_services)}`, available: true },
          { label: `Fotos por producto/servicio/publicación: ${plan.max_photos_per_item}`, available: true },
          { label: `Personas en el equipo: ${limitLabel(plan.max_employees)}`, available: true },
          { label: `Historias activas: ${limitLabel(plan.max_active_stories)}`, available: true },
          { label: `Dashboard/métricas: ${dashboardTierLabel[plan.name] ?? plan.name}`, available: true },
          { label: 'Insignia de verificado (KYC)', available: plan.name !== 'free' },
        ];
        return (
          <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{planLabel[plan.name] ?? plan.name}</Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Tu plan actual</Text>
                </View>
              )}
            </View>

            <View style={styles.priceRow}>
              {plan.price_monthly > 0 ? (
                <>
                  <Text style={styles.priceAmount}>${plan.price_monthly.toFixed(2)}</Text>
                  <Text style={styles.pricePeriod}>/mes</Text>
                </>
              ) : (
                <Text style={styles.priceAmount}>Gratis</Text>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              {features.map((feature) => (
                <View key={feature.label} style={styles.featureRow}>
                  <Ionicons
                    name={feature.available ? 'checkmark-circle' : 'remove-circle-outline'}
                    size={18}
                    color={feature.available ? colors.primary : colors.border}
                  />
                  <Text style={[styles.feature, !feature.available && styles.featureUnavailable]}>
                    {feature.label}
                  </Text>
                </View>
              ))}
            </View>

            {isOwner && !isCurrent && (
              <Button
                title={plan.price_monthly > 0 ? `Obtener plan ${planLabel[plan.name] ?? plan.name}` : `Cambiar a plan ${planLabel[plan.name] ?? plan.name}`}
                variant={plan.price_monthly > 0 ? 'primary' : 'secondary'}
                onPress={() => handleSwitch(plan)}
                loading={switching === plan.id}
                style={styles.switchButton}
              />
            )}

            {isOwner && canRenewSoon && (
              <>
                <Text style={styles.renewNotice}>
                  Tu plan vence en {Math.max(0, Math.ceil(daysLeft!))} día(s). Renueva ahora para no perder tus beneficios.
                </Text>
                <Button
                  title={`Renovar plan ${planLabel[plan.name] ?? plan.name}`}
                  onPress={() => handleSwitch(plan)}
                  loading={switching === plan.id}
                  style={styles.switchButton}
                />
              </>
            )}
          </View>
        );
      })}

      {!isOwner && (
        <Text style={styles.helperText}>Solo el dueño del negocio puede cambiar el plan.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFF8F2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  currentBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 14,
  },
  priceAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 42,
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: 4,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feature: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  featureUnavailable: {
    color: colors.textMuted,
  },
  switchButton: {
    marginTop: 20,
  },
  renewNotice: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 16,
  },
});
