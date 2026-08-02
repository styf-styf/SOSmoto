import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import {
  getBusinessStockMovements,
  REASON_LABEL,
  type BusinessStockMovement,
} from '../../services/inventory';

const PAGE_SIZE = 50;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistorialMovimientosScreen() {
  const { profile } = useAuth();
  const businessIdRef = useRef<string | null>(null);
  const [movements, setMovements] = useState<BusinessStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    businessIdRef.current = work.business.id;
    const movs = await getBusinessStockMovements(work.business.id, PAGE_SIZE);
    setMovements(movs);
    setHasMore(movs.length === PAGE_SIZE);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load stock movements error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error('refresh stock movements error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    const businessId = businessIdRef.current;
    if (!businessId || movements.length === 0) return;
    setLoadingMore(true);
    try {
      const more = await getBusinessStockMovements(businessId, PAGE_SIZE, movements[movements.length - 1].created_at);
      setMovements((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      console.error('load more stock movements error', err);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {movements.length === 0 ? (
        <Text style={styles.empty}>Sin movimientos registrados.</Text>
      ) : (
        movements.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: m.delta >= 0 ? colors.success : colors.danger }]} />
            <View style={styles.rowContent}>
              <Text style={styles.productName} numberOfLines={1}>
                {m.product_name}
                {m.variant_label ? ` (${m.variant_label})` : ''}
              </Text>
              <Text style={styles.label}>
                {m.delta >= 0 ? `+${m.delta}` : m.delta} uds — {REASON_LABEL[m.reason]}
              </Text>
              {m.reason === 'sale' && (
                <Text style={styles.source}>
                  {m.client_name ? `Cliente: ${m.client_name}` : 'Salida manual (sin apartado)'}
                </Text>
              )}
              {m.notes && <Text style={styles.notes}>{m.notes}</Text>}
              <Text style={styles.date}>{fmtDate(m.created_at)}</Text>
            </View>
          </View>
        ))
      )}

      {hasMore && movements.length > 0 && (
        <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.loadMoreText}>Cargar más</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, backgroundColor: colors.background, paddingBottom: 40 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 16 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowContent: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  source: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  notes: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  date: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  loadMoreBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  loadMoreText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
