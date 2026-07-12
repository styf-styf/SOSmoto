import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { signOut } from '../../services/auth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPlanLimits, type PlanLimits } from '../../services/catalog';
import { getEmployees } from '../../services/employees';
import { getPendingRequests } from '../../services/helpRequests';
import type { Business } from '../../types/database';

const planLabel: Record<string, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

interface BusinessConfigData {
  business: Business | null;
  plan: PlanLimits | null;
  pendingCount: number;
  employeeCount: number;
}

export default function BusinessConfiguracionScreen() {
  const { profile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `business-config-${profile.id}` : null;
  const { data, loading, reload } = useCachedLoad<BusinessConfigData>(cacheKey, async () => {
    if (!profile) return { business: null, plan: null, pendingCount: 0, employeeCount: 0 };
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    if (!myBusiness) return { business: null, plan: null, pendingCount: 0, employeeCount: 0 };
    const [planLimits, pending, employees] = await Promise.all([
      getPlanLimits(myBusiness.id),
      getPendingRequests(myBusiness.id),
      getEmployees(myBusiness.id),
    ]);
    return { business: myBusiness, plan: planLimits, pendingCount: pending.length, employeeCount: employees.length };
  });
  const business = data?.business ?? null;
  const plan = data?.plan ?? null;
  const pendingCount = data?.pendingCount ?? 0;
  const employeeCount = data?.employeeCount ?? 0;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('refresh business config error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('sign out error', err);
      setSigningOut(false);
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
        <Text style={styles.placeholder}>No tienes un negocio registrado.</Text>
        <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} loading={signingOut} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      <View style={styles.planBadge}>
        <Text style={styles.planBadgeText}>
          Plan {plan ? planLabel[plan.planName] ?? plan.planName : '...'}
          {business.is_verified ? ' · Verificado' : ''}
        </Text>
      </View>

      {business.business_type === 'workshop' && (
        <Pressable style={styles.statCard} onPress={() => router.push('/(business)/solicitudes')}>
          <Text style={styles.statLabel}>Solicitudes de auxilio pendientes</Text>
          <Text style={[styles.statValue, pendingCount > 0 && styles.statValueAlert]}>{pendingCount}</Text>
        </Pressable>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Mi negocio</Text>
      <View style={styles.menuGroup}>
        <MenuRow icon="storefront-outline" label="Datos del negocio" onPress={() => router.push('/(business)/datos-negocio')} />
        <MenuRow icon="time-outline" label="Horario" onPress={() => router.push('/(business)/horario')} />
        <MenuRow
          icon="people-circle-outline"
          label="Equipo"
          badge={employeeCount > 0 ? `${employeeCount} persona${employeeCount === 1 ? '' : 's'}` : undefined}
          onPress={() => router.push('/(business)/empleados')}
        />
        <MenuRow icon="grid-outline" label="Catálogo" onPress={() => router.push('/(business)/catalogo')} />
        {business.business_type === 'workshop' && (
          <MenuRow icon="calendar-outline" label="Agenda" onPress={() => router.push('/(business)/agenda-negocio')} />
        )}
        <MenuRow icon="people-outline" label="Clientes" onPress={() => router.push('/(business)/clientes')} />
        <MenuRow icon="film-outline" label="Historias" onPress={() => router.push('/(business)/historias')} />
        <MenuRow
          icon="images-outline"
          label="Publicaciones"
          onPress={() => router.push('/(business)/publicaciones')}
          last={business.business_type !== 'workshop'}
        />
        {business.business_type === 'workshop' && (
          <MenuRow icon="build-outline" label="Recordatorios de mantenimiento" onPress={() => router.push('/(business)/mantenimiento-proactivo')} />
        )}
        {business.business_type === 'workshop' && (
          <MenuRow icon="bag-handle-outline" label="Mis compras" onPress={() => router.push('/(business)/mis-compras')} last />
        )}
      </View>

      <Text style={styles.sectionTitle}>Crecimiento</Text>
      <View style={styles.menuGroup}>
        <MenuRow icon="stats-chart-outline" label="Estadísticas" onPress={() => router.push('/(business)/estadisticas')} />
        <MenuRow icon="megaphone-outline" label="Publicidad" onPress={() => router.push('/(business)/publicidad')} />
        <MenuRow icon="trending-up-outline" label="Crece tu negocio" onPress={() => router.push('/(business)/crece-tu-negocio')} last />
      </View>

      <Text style={styles.sectionTitle}>Plan y cuenta</Text>
      <View style={styles.menuGroup}>
        <MenuRow
          icon="card-outline"
          label="Plan y suscripción"
          badge={plan ? planLabel[plan.planName] ?? plan.planName : undefined}
          onPress={() => router.push('/(business)/suscripcion')}
        />
        <MenuRow
          icon="shield-checkmark-outline"
          label="Verificación"
          badge={business.is_verified ? 'Verificado ✓' : undefined}
          onPress={() => router.push('/(business)/verificacion')}
        />
        <MenuRow
          icon="alert-circle-outline"
          label="Estado de cuenta"
          badge={business.is_limited ? 'Limitado' : undefined}
          badgeDanger={business.is_limited}
          onPress={() => router.push('/(business)/estado-cuenta')}
          last
        />
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.signOutRow, pressed && styles.menuRowPressed]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        )}
        <Text style={styles.signOutLabel}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  badge,
  badgeDanger,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  badgeDanger?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, !last && styles.menuRowBorder, pressed && styles.menuRowPressed]}
      onPress={onPress}
    >
      <View style={styles.menuRowIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.menuRowLabel}>{label}</Text>
      {badge && <Text style={[styles.menuRowBadge, badgeDanger && styles.menuRowBadgeDanger]}>{badge}</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  planBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statValueAlert: {
    color: colors.danger,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowPressed: {
    opacity: 0.55,
  },
  menuRowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  menuRowBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  menuRowBadgeDanger: {
    color: colors.danger,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },
});
