import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPlanLimits } from '../../services/catalog';
import {
  getBusinessCatalogSnapshot,
  getBusinessPeriodStats,
  type BusinessDashboardStats,
  type CatalogSnapshot,
  type DashboardPeriod,
  type PeriodStats,
} from '../../services/dashboard';
import { shareDashboardAsCsv, shareDashboardAsPdf } from '../../utils/dashboardExport';
import { TrendBarChart } from '../../components/TrendBarChart';

const planLabel: Record<string, string> = {
  free: 'Básico',
  standard: 'Intermedio',
  pro: 'Avanzado',
};

const periodLabel: Record<DashboardPeriod, string> = {
  week: 'Semana',
  month: 'Mes',
  all: 'Todo',
  custom: 'Rango',
};

export default function EstadisticasScreen() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const [customFrom, setCustomFrom] = useState(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [customTo, setCustomTo] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [planName, setPlanName] = useState('free');
  const [catalogSnapshot, setCatalogSnapshot] = useState<CatalogSnapshot | null>(null);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [canHaveServices, setCanHaveServices] = useState(false);
  const [loading, setLoading] = useState(true);
  // Distinto de `loading` (carga inicial, pantalla completa) -- cambiar de
  // período NO debe ocultar todo el dashboard y volver a montarlo desde
  // cero (eso se sentía lento aunque la consulta fuera rápida, por el
  // costo de re-renderizar tarjetas/gráficas). Con esto el contenido
  // anterior se queda visible mientras carga el nuevo período.
  const [periodLoading, setPeriodLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  // catalogSnapshot (más vistos, anuncios/historias de siempre, conversión
  // histórica) NO depende del período -- se pide una sola vez acá. Antes se
  // volvía a pedir completo (con sus consultas encadenadas) en cada cambio
  // de Semana/Mes/Todo/Rango, que era la demora real; ahora ese cambio solo
  // dispara loadPeriod, mucho más liviano.
  const loadInitial = useCallback(
    async (forPeriod: DashboardPeriod, range?: { from: Date; to: Date }) => {
      if (!profile) return;
      const work = await getMyWorkBusiness(profile.id);
      if (!work) return;
      setCanHaveServices(work.business.business_type === 'workshop');
      setBusinessName(work.business.name);
      setBusinessId(work.business.id);
      const [limits, snapshot, period] = await Promise.all([
        getPlanLimits(work.business.id),
        getBusinessCatalogSnapshot(work.business.id),
        getBusinessPeriodStats(work.business.id, forPeriod, range),
      ]);
      setPlanName(limits.planName);
      setCatalogSnapshot(snapshot);
      setPeriodStats(period);
    },
    [profile]
  );

  const loadPeriod = useCallback(
    async (forPeriod: DashboardPeriod, range?: { from: Date; to: Date }) => {
      if (!businessId) return;
      const period = await getBusinessPeriodStats(businessId, forPeriod, range);
      setPeriodStats(period);
    },
    [businessId]
  );

  const currentCustomRange = { from: customFrom, to: customTo };
  const stats: BusinessDashboardStats | null = catalogSnapshot && periodStats ? { ...catalogSnapshot, ...periodStats } : null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadInitial(period, period === 'custom' ? currentCustomRange : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePeriodChange(next: DashboardPeriod) {
    setPeriod(next);
    if (next === 'custom') return; // espera a que el usuario elija fechas y toque "Aplicar"
    setPeriodLoading(true);
    try {
      await loadPeriod(next);
    } catch (err) {
      console.error('load estadisticas period error', err);
    } finally {
      setPeriodLoading(false);
    }
  }

  async function handleApplyCustomRange() {
    setPeriodLoading(true);
    try {
      await loadPeriod('custom', currentCustomRange);
    } catch (err) {
      console.error('load estadisticas custom range error', err);
    } finally {
      setPeriodLoading(false);
    }
  }

  async function handleExport(format: 'csv' | 'pdf') {
    if (!stats) return;
    setExporting(format);
    try {
      if (format === 'csv') await shareDashboardAsCsv(stats, businessName);
      else await shareDashboardAsPdf(stats, businessName);
    } finally {
      setExporting(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadInitial(period, period === 'custom' ? currentCustomRange : undefined)
        .catch((err) => console.error('load estadisticas error', err))
        .finally(() => setLoading(false));
      // Solo al ganar foco -- cambiar de periodo/rango ya dispara su propia
      // carga en handlePeriodChange/handleApplyCustomRange.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadInitial])
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
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <View style={styles.headerRow}>
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>
            Dashboard {planLabel[planName] ?? planLabel.free}
          </Text>
        </View>
        {periodLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <View style={styles.periodSelector}>
        {(showAvanzado ? (['week', 'month', 'all', 'custom'] as DashboardPeriod[]) : (['week', 'month', 'all'] as DashboardPeriod[])).map((p) => (
          <Text
            key={p}
            onPress={() => !periodLoading && handlePeriodChange(p)}
            style={[styles.periodOption, period === p && styles.periodOptionActive, periodLoading && styles.periodOptionDisabled]}
          >
            {periodLabel[p]}
          </Text>
        ))}
      </View>

      {period === 'custom' && (
        <View style={styles.customRangeRow}>
          <Pressable style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.dateBtnText}>Desde: {customFrom.toLocaleDateString('es-EC')}</Text>
          </Pressable>
          <Pressable style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
            <Text style={styles.dateBtnText}>Hasta: {customTo.toLocaleDateString('es-EC')}</Text>
          </Pressable>
          <Pressable style={[styles.applyBtn, periodLoading && styles.periodOptionDisabled]} onPress={handleApplyCustomRange} disabled={periodLoading}>
            <Text style={styles.applyBtnText}>Aplicar</Text>
          </Pressable>
          {showFromPicker && (
            <DateTimePicker
              value={customFrom}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              maximumDate={customTo}
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowFromPicker(false);
                if (date) setCustomFrom(date);
              }}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={customTo}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={customFrom}
              maximumDate={new Date()}
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowToPicker(false);
                if (date) setCustomTo(date);
              }}
            />
          )}
        </View>
      )}

      {canHaveServices && (
        <>
          <View style={styles.row}>
            <StatCard label="Auxilios recibidos" value={stats.helpRequestsTotal} prevValue={showIntermedio ? stats.helpRequestsPrevTotal : null} />
            <StatCard label="Auxilios completados" value={stats.helpRequestsCompleted} />
          </View>
          <View style={styles.row}>
            <StatCard label="Citas recibidas" value={stats.appointmentsTotal} prevValue={showIntermedio ? stats.appointmentsPrevTotal : null} />
            <StatCard label="Citas completadas" value={stats.appointmentsCompleted} />
          </View>

          {showIntermedio && stats.avgResponseMinutes !== null && (
            <View style={styles.row}>
              <StatCard
                label="Tiempo de respuesta al auxilio"
                value={formatMinutes(stats.avgResponseMinutes)}
                prevValue={stats.avgResponseMinutesPrev}
                rawValue={stats.avgResponseMinutes}
                lowerIsBetter
                wide
              />
            </View>
          )}

          {showAvanzado && (stats.peakHelpRequestTime || stats.peakAppointmentTime) && (
            <View style={styles.row}>
              {stats.peakHelpRequestTime && (
                <PeakCard icon="alert-circle-outline" title="Pico de auxilios" peak={stats.peakHelpRequestTime} />
              )}
              {stats.peakAppointmentTime && (
                <PeakCard icon="calendar-outline" title="Pico de citas" peak={stats.peakAppointmentTime} />
              )}
            </View>
          )}

          {showIntermedio && stats.trend.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Tendencia de auxilios y citas</Text>
              <TrendBarChart
                data={stats.trend}
                series={[
                  { key: 'helpRequests', label: 'Auxilios', color: colors.primary },
                  { key: 'appointments', label: 'Citas', color: colors.success },
                ]}
              />
            </>
          )}
        </>
      )}

      {showIntermedio && stats.ratingCount > 0 && (
        <View style={styles.row}>
          <StatCard
            label={`Calificación (${stats.ratingCount} reseña${stats.ratingCount === 1 ? '' : 's'})`}
            value={stats.ratingAvg !== null ? stats.ratingAvg.toFixed(1) : 'N/D'}
            prevValue={stats.ratingAvgPrev}
            rawValue={stats.ratingAvg}
            wide
          />
        </View>
      )}

      {showAvanzado && (
        <>
          <View style={styles.row}>
            <StatCard label="Seguidores nuevos" value={stats.followersGained} prevValue={stats.followersGainedPrevTotal} wide />
          </View>
          {stats.followersTrend.length > 0 && (
            <TrendBarChart data={stats.followersTrend} series={[{ key: 'followers', label: 'Seguidores', color: colors.primary }]} />
          )}
        </>
      )}

      {showIntermedio && stats.catalogConversionRate !== null && (
        <View style={styles.row}>
          <StatCard
            label="Conversión de catálogo (apartados / vistas, histórico)"
            value={`${Math.round(stats.catalogConversionRate * 100)}%`}
            wide
          />
        </View>
      )}

      {!showIntermedio && (
        <Text style={styles.upsell} onPress={() => router.push('/(business)/suscripcion')}>
          Sube a plan Estándar para ver tus productos/servicios más vistos y las métricas de publicidad e historias.
        </Text>
      )}

      {showIntermedio && (
        <>
          <Text style={styles.sectionTitle}>Productos más vistos</Text>
          {stats.topProducts.length === 0 ? (
            <Text style={styles.placeholder}>Sin vistas registradas todavía.</Text>
          ) : (
            stats.topProducts.map((p) => (
              <RankedRow
                key={p.id}
                name={p.name}
                views={p.views}
                reservations={p.reservations}
                completed={p.completed}
                reservationsLabel="reservas"
                completedLabel="vendidos"
              />
            ))
          )}

          {canHaveServices && (
            <>
              <Text style={styles.sectionTitle}>Servicios más vistos</Text>
              {stats.topServices.length === 0 ? (
                <Text style={styles.placeholder}>Sin vistas registradas todavía.</Text>
              ) : (
                stats.topServices.map((s) => (
                  <RankedRow
                    key={s.id}
                    name={s.name}
                    views={s.views}
                    reservations={s.reservations}
                    completed={s.completed}
                    reservationsLabel="citas"
                    completedLabel="completadas"
                  />
                ))
              )}
            </>
          )}

          <View style={styles.row}>
            <StatCard label="Vistas de productos" value={stats.productViewsTotal} prevValue={stats.productViewsPrevTotal} />
            {canHaveServices && (
              <StatCard label="Vistas de servicios" value={stats.serviceViewsTotal} prevValue={stats.serviceViewsPrevTotal} />
            )}
          </View>
          {stats.catalogTrend.length > 0 && (
            <TrendBarChart
              data={stats.catalogTrend}
              series={
                canHaveServices
                  ? [
                      { key: 'productViews', label: 'Vistas de productos', color: colors.primary },
                      { key: 'serviceViews', label: 'Vistas de servicios', color: colors.success },
                    ]
                  : [{ key: 'productViews', label: 'Vistas de productos', color: colors.primary }]
              }
            />
          )}

          <Text style={styles.sectionTitle}>Publicidad e historias</Text>
          <View style={styles.row}>
            <StatCard label="Impresiones de anuncios" value={stats.adImpressions} prevValue={stats.adImpressionsPrevTotal} />
            <StatCard label="Clics en anuncios" value={stats.adClicks} prevValue={stats.adClicksPrevTotal} />
          </View>
          <View style={styles.row}>
            <StatCard label="Vistas de historias (histórico)" value={stats.storyViews} />
            <StatCard label="Clics en historias" value={stats.storyClicks} prevValue={stats.storyClicksPrevTotal} />
          </View>
        </>
      )}

      {showAvanzado && canHaveServices && (
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

      {showAvanzado ? (
        <>
          <Text style={styles.sectionTitle}>Exportar</Text>
          <View style={styles.row}>
            <Pressable style={styles.exportBtn} onPress={() => handleExport('csv')} disabled={exporting !== null}>
              {exporting === 'csv' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.exportBtnText}>CSV</Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={() => handleExport('pdf')} disabled={exporting !== null}>
              {exporting === 'pdf' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="document-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.exportBtnText}>PDF</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.upsell} onPress={() => router.push('/(business)/suscripcion')}>Sube a plan Pro para ver horas/días pico, seguidores, rango de fechas personalizado y exportar a CSV/PDF.</Text>
      )}
    </ScrollView>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)} h`;
}

function PeakCard({ icon, title, peak }: { icon: keyof typeof Ionicons.glyphMap; title: string; peak: { dayLabel: string; hourLabel: string } }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.peakHeader}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={styles.statLabel}>{title}</Text>
      </View>
      <Text style={styles.peakValue}>{peak.dayLabel}</Text>
      <Text style={styles.statMeta}>{peak.hourLabel}</Text>
    </View>
  );
}

// prevValue: total del periodo anterior (comparación simple, ya viene
// formateado desde el llamador si aplica). rawValue+lowerIsBetter: para
// métricas donde "menos" es mejor (tiempo de respuesta), invierte el color
// de la flecha -- de resto verde=subió, rojo=bajó.
function StatCard({
  label,
  value,
  prevValue,
  rawValue,
  lowerIsBetter,
  wide,
}: {
  label: string;
  value: number | string;
  prevValue?: number | null;
  rawValue?: number | null;
  lowerIsBetter?: boolean;
  wide?: boolean;
}) {
  const numericValue = rawValue ?? (typeof value === 'number' ? value : null);
  const hasDelta = prevValue !== undefined && prevValue !== null && numericValue !== null && prevValue > 0;
  const delta = hasDelta ? ((numericValue as number) - (prevValue as number)) / (prevValue as number) : null;
  const isGood = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);

  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {delta !== null && Math.abs(delta) >= 0.01 && (
          <View style={styles.deltaRow}>
            <Ionicons
              name={delta > 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={isGood ? colors.success : colors.danger}
            />
            <Text style={[styles.deltaText, { color: isGood ? colors.success : colors.danger }]}>
              {Math.abs(Math.round(delta * 100))}%
            </Text>
          </View>
        )}
      </View>
      {hasDelta && <Text style={styles.statMeta}>vs. periodo anterior</Text>}
    </View>
  );
}

function RankedRow({
  name,
  views,
  reservations,
  completed,
  reservationsLabel,
  completedLabel,
}: {
  name: string;
  views: number;
  reservations: number;
  completed: number;
  reservationsLabel: string;
  completedLabel: string;
}) {
  return (
    <View style={styles.rankedRow}>
      <Text style={styles.rankedName} numberOfLines={1}>{name}</Text>
      <View style={styles.rankedStats}>
        <Text style={styles.rankedValue}>{views} vistas</Text>
        <Text style={styles.rankedValueMuted}>{reservations} {reservationsLabel}</Text>
        <Text style={styles.rankedValueMuted}>{completed} {completedLabel}</Text>
      </View>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  planBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  periodOption: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    overflow: 'hidden',
  },
  periodOptionActive: {
    backgroundColor: colors.background,
    color: colors.primary,
  },
  periodOptionDisabled: {
    opacity: 0.5,
  },
  customRangeRow: {
    marginBottom: 16,
  },
  dateBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dateBtnText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  peakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  peakValue: {
    fontSize: 16,
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
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rankedName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  rankedStats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  rankedValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  rankedValueMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
