import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPlanLimits } from '../../services/catalog';
import { getBusinessDashboardStats, type BusinessDashboardStats } from '../../services/dashboard';

const planLabel: Record<string, string> = {
  free: 'Básico',
  standard: 'Intermedio',
  pro: 'Avanzado',
};

export default function EstadisticasScreen() {
  const { profile } = useAuth();
  const [planName, setPlanName] = useState('free');
  const [stats, setStats] = useState<BusinessDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    const [limits, dashboardStats] = await Promise.all([
      getPlanLimits(work.business.id),
      getBusinessDashboardStats(work.business.id),
    ]);
    setPlanName(limits.planName);
    setStats(dashboardStats);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.error('load estadisticas error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea tu negocio.</Text>
      </View>
    );
  }

  const showIntermedio = planName === 'standard' || planName === 'pro';
  const showAvanzado = planName === 'pro';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.planBadge}>
        <Text style={styles.planBadgeText}>Dashboard {planLabel[planName] ?? planLabel.free}</Text>
      </View>

      <View style={styles.row}>
        <StatCard label="Auxilios recibidos" value={stats.helpRequestsTotal} />
        <StatCard label="Auxilios completados" value={stats.helpRequestsCompleted} />
      </View>
      <View style={styles.row}>
        <StatCard label="Citas recibidas" value={stats.appointmentsTotal} />
        <StatCard label="Citas completadas" value={stats.appointmentsCompleted} />
      </View>

      {!showIntermedio && (
        <Text style={styles.upsell}>
          Sube a plan Estándar para ver tus productos/servicios más vistos y las métricas de publicidad e historias.
        </Text>
      )}

      {showIntermedio && (
        <>
          <Text style={styles.sectionTitle}>Productos más vistos</Text>
          {stats.topProducts.length === 0 ? (
            <Text style={styles.placeholder}>Sin vistas registradas todavía.</Text>
          ) : (
            stats.topProducts.map((p) => <RankedRow key={p.id} name={p.name} value={p.views} />)
          )}

          <Text style={styles.sectionTitle}>Servicios más vistos</Text>
          {stats.topServices.length === 0 ? (
            <Text style={styles.placeholder}>Sin vistas registradas todavía.</Text>
          ) : (
            stats.topServices.map((s) => <RankedRow key={s.id} name={s.name} value={s.views} />)
          )}

          <Text style={styles.sectionTitle}>Publicidad e historias</Text>
          <View style={styles.row}>
            <StatCard label="Impresiones de anuncios" value={stats.adImpressions} />
            <StatCard label="Clics en anuncios" value={stats.adClicks} />
          </View>
          <View style={styles.row}>
            <StatCard label="Vistas de historias" value={stats.storyViews} />
            <StatCard label="Clics en historias" value={stats.storyClicks} />
          </View>
        </>
      )}

      {showAvanzado && (
        <>
          <Text style={styles.sectionTitle}>Conversión</Text>
          <StatCard
            label="Tasa de citas completadas"
            value={
              stats.appointmentsConversionRate !== null
                ? `${Math.round(stats.appointmentsConversionRate * 100)}%`
                : 'N/D'
            }
            wide
          />
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, wide }: { label: string; value: number | string; wide?: boolean }) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RankedRow({ name, value }: { name: string; value: number }) {
  return (
    <View style={styles.rankedRow}>
      <Text style={styles.rankedName}>{name}</Text>
      <Text style={styles.rankedValue}>{value} vistas</Text>
    </View>
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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  planBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  statCardWide: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 10,
  },
  upsell: {
    fontSize: 13,
    color: colors.primary,
    backgroundColor: '#FFF1E6',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  rankedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rankedName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  rankedValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
