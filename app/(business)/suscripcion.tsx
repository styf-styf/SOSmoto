import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness, getSubscriptionPlans, updateBusinessPlan } from '../../services/businesses';
import { getAllProducts, getAllServices } from '../../services/catalog';
import { getEmployees } from '../../services/employees';
import { getActiveSubscription, getWebLoginCode } from '../../services/payments';
import type { Business, SubscriptionPlan } from '../../types/database';

const SUBSCRIPTION_PORTAL_URL = 'https://so-smoto.vercel.app/api/suscripcion';

const planLabel: Record<string, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

function limitLabel(value: number | null): string {
  return value === null ? 'Ilimitado' : String(value);
}

export default function SuscripcionScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState({ services: 0, products: 0, employees: 0 });
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusiness(work.business);
    setIsOwner(work.isOwner);

    const [allPlans, services, products, employees, activeSub] = await Promise.all([
      getSubscriptionPlans(),
      getAllServices(work.business.id),
      getAllProducts(work.business.id),
      getEmployees(work.business.id),
      getActiveSubscription(work.business.id),
    ]);
    setPlans(allPlans);
    setUsage({
      services: services.filter((s) => s.is_active).length,
      products: products.filter((p) => p.is_active).length,
      employees: employees.length + 1,
    });
    setExpiresAt(activeSub?.expires_at ?? null);
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load suscripcion error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function openPortal() {
    try {
      const code = await getWebLoginCode();
      await Linking.openURL(`${SUBSCRIPTION_PORTAL_URL}?code=${code}`);
    } catch (err) {
      console.error('open portal error', err);
      // Si no se pudo generar el código de auto-login, igual lo dejamos
      // entrar y que se loguee a mano en el portal.
      Linking.openURL(SUBSCRIPTION_PORTAL_URL).catch(() =>
        Alert.alert('Error', 'No se pudo abrir el portal de pagos.')
      );
    }
  }

  async function handleSwitch(plan: SubscriptionPlan) {
    if (!business) return;

    if (plan.price_monthly > 0) {
      setSwitching(plan.id);
      try {
        await openPortal();
      } finally {
        setSwitching(null);
      }
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

    const proceed = () => doSwitch(plan.id);

    if (warnings.length > 0) {
      Alert.alert(
        'Estás por encima del límite de este plan',
        `Al cambiarte a ${planLabel[plan.name]}, ${warnings.join('; ')}. No se eliminará nada, pero no podrás agregar más hasta bajar de esos números. ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cambiar de todas formas', onPress: proceed },
        ]
      );
    } else {
      proceed();
    }
  }

  async function doSwitch(planId: string) {
    if (!business) return;
    setSwitching(planId);
    try {
      const updated = await updateBusinessPlan(business.id, planId);
      setBusiness(updated);
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
        return (
          <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{planLabel[plan.name] ?? plan.name}</Text>
              {isCurrent && <Text style={styles.currentBadge}>Tu plan actual</Text>}
            </View>
            <Text style={styles.cardPrice}>
              {plan.price_monthly > 0 ? `$${plan.price_monthly.toFixed(2)}/mes` : 'Gratis'}
            </Text>

            <View style={styles.featureList}>
              <Text style={styles.feature}>Productos: {limitLabel(plan.max_products)}</Text>
              <Text style={styles.feature}>Servicios: {limitLabel(plan.max_services)}</Text>
              <Text style={styles.feature}>Fotos por ítem: {plan.max_photos_per_item}</Text>
              <Text style={styles.feature}>Personas en el equipo: {limitLabel(plan.max_employees)}</Text>
              <Text style={styles.feature}>
                Matching de auxilio: {plan.has_priority_matching ? 'con prioridad' : 'normal'}
              </Text>
              <Text style={styles.feature}>
                Posición en búsqueda: {plan.has_featured_listing ? 'destacada' : 'normal'}
              </Text>
            </View>

            {isOwner && !isCurrent && (
              <Button
                title={plan.price_monthly > 0 ? 'Pagar desde el portal web' : 'Cambiar a este plan'}
                variant="secondary"
                onPress={() => handleSwitch(plan)}
                loading={switching === plan.id}
                style={styles.switchButton}
              />
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCurrent: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
    marginBottom: 10,
  },
  featureList: {
    gap: 4,
  },
  feature: {
    fontSize: 13,
    color: colors.textMuted,
  },
  switchButton: {
    marginTop: 14,
  },
});
