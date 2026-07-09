import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import {
  addStockMovement,
  getInventory,
  getStockMovements,
  type ProductWithMovements,
  type StockMovementReason,
} from '../../services/inventory';
import type { StockMovement } from '../../types/database';

type FilterTab = 'all' | 'low' | 'out';
type MovementType = 'entry' | 'exit' | 'adjustment';

const REASON_LABEL: Record<StockMovementReason, string> = {
  entry: 'Entrada',
  sale: 'Venta',
  adjustment: 'Ajuste',
  damage: 'Daño / pérdida',
  other: 'Otro',
};

const STOCK_COLORS = {
  out: colors.danger,
  low: '#F57C00',
  ok: colors.success,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InventarioScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductWithMovements[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  // Panel de movimiento
  const [selected, setSelected] = useState<ProductWithMovements | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [movType, setMovType] = useState<MovementType>('entry');
  const [quantity, setQuantity] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [reason, setReason] = useState<StockMovementReason>('entry');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusinessId(work.business.id);
    const inv = await getInventory(work.business.id);
    setProducts(inv);
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load inventory error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function selectProduct(product: ProductWithMovements) {
    if (selected?.id === product.id) {
      setSelected(null);
      return;
    }
    setSelected(product);
    setMovType('entry');
    setReason('entry');
    setQuantity('');
    setNewTotal(String(product.stock));
    setNotes('');
    setLoadingMov(true);
    try {
      const movs = await getStockMovements(product.id);
      setMovements(movs);
    } catch (err) {
      console.error('load movements error', err);
    } finally {
      setLoadingMov(false);
    }
  }

  function handleMovTypeChange(type: MovementType) {
    setMovType(type);
    setQuantity('');
    setNewTotal(selected ? String(selected.stock) : '');
    if (type === 'entry') setReason('entry');
    else if (type === 'exit') setReason('sale');
    else setReason('adjustment');
  }

  async function handleSaveMovement() {
    if (!selected || !businessId) return;

    let delta = 0;
    if (movType === 'entry') {
      const qty = parseInt(quantity, 10);
      if (!qty || qty <= 0) { Alert.alert('Cantidad inválida', 'Ingresa una cantidad mayor a 0.'); return; }
      delta = qty;
    } else if (movType === 'exit') {
      const qty = parseInt(quantity, 10);
      if (!qty || qty <= 0) { Alert.alert('Cantidad inválida', 'Ingresa una cantidad mayor a 0.'); return; }
      delta = -qty;
    } else {
      const tot = parseInt(newTotal, 10);
      if (isNaN(tot) || tot < 0) { Alert.alert('Total inválido', 'Ingresa un valor mayor o igual a 0.'); return; }
      delta = tot - selected.stock;
      if (delta === 0) { Alert.alert('Sin cambios', 'El stock nuevo es igual al actual.'); return; }
    }

    setSaving(true);
    try {
      const updated = await addStockMovement({
        businessId,
        productId: selected.id,
        delta,
        reason,
        notes: notes.trim() || undefined,
        currentStock: selected.stock,
      });
      const newLevel: 'out' | 'low' | 'ok' = updated.stock <= 0 ? 'out' : updated.stock <= 5 ? 'low' : 'ok';
      // Actualiza lista local
      setProducts((prev) =>
        prev
          .map((p) =>
            p.id === selected.id ? { ...p, stock: updated.stock, stockLevel: newLevel } : p
          )
          .sort((a, b) => a.stock - b.stock)
      );
      setSelected((prev) => prev ? { ...prev, stock: updated.stock, stockLevel: newLevel } : null);
      // Recarga historial
      const movs = await getStockMovements(selected.id);
      setMovements(movs);
      setQuantity('');
      setNewTotal(String(updated.stock));
      setNotes('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = products.filter((p) => {
    if (filter === 'out') return p.stockLevel === 'out';
    if (filter === 'low') return p.stockLevel === 'low';
    return true;
  });

  const totalOut = products.filter((p) => p.stockLevel === 'out').length;
  const totalLow = products.filter((p) => p.stockLevel === 'low').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      {/* Resumen */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{products.length}</Text>
          <Text style={styles.summaryLabel}>Productos</Text>
        </View>
        <View style={[styles.summaryCard, totalLow > 0 && styles.summaryCardWarn]}>
          <Text style={[styles.summaryNum, totalLow > 0 && { color: '#F57C00' }]}>{totalLow}</Text>
          <Text style={styles.summaryLabel}>Bajo stock</Text>
        </View>
        <View style={[styles.summaryCard, totalOut > 0 && styles.summaryCardDanger]}>
          <Text style={[styles.summaryNum, totalOut > 0 && { color: colors.danger }]}>{totalOut}</Text>
          <Text style={styles.summaryLabel}>Sin stock</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {(['all', 'low', 'out'] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'all' ? 'Todos' : tab === 'low' ? 'Bajo stock' : 'Sin stock'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 && (
        <Text style={styles.empty}>
          {filter === 'all' ? 'No hay productos en el catálogo.' : 'No hay productos en esta categoría.'}
        </Text>
      )}

      {filtered.map((product) => {
        const isOpen = selected?.id === product.id;
        return (
          <View key={product.id} style={styles.card}>
            {/* Fila principal */}
            <Pressable style={styles.cardRow} onPress={() => selectProduct(product)}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{product.name}</Text>
                {product.category_name && <Text style={styles.cardMeta}>{product.category_name}</Text>}
                {!product.is_active && <Text style={styles.inactiveTag}>Inactivo</Text>}
              </View>
              <View style={styles.stockBadge}>
                <View style={[styles.stockDot, { backgroundColor: STOCK_COLORS[product.stockLevel] }]} />
                <Text style={[styles.stockNum, { color: STOCK_COLORS[product.stockLevel] }]}>
                  {product.stock}
                </Text>
                <Text style={styles.stockUnit}>uds</Text>
              </View>
              <Ionicons
                name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={18}
                color={colors.textMuted}
                style={{ marginLeft: 8 }}
              />
            </Pressable>

            {/* Panel de movimiento */}
            {isOpen && (
              <View style={styles.panel}>
                {/* Tipo de movimiento */}
                <View style={styles.movTypeTabs}>
                  {(['entry', 'exit', 'adjustment'] as MovementType[]).map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.movTypeTab, movType === t && styles.movTypeTabActive]}
                      onPress={() => handleMovTypeChange(t)}
                    >
                      <Ionicons
                        name={t === 'entry' ? 'arrow-down-circle-outline' : t === 'exit' ? 'arrow-up-circle-outline' : 'create-outline'}
                        size={15}
                        color={movType === t ? '#fff' : colors.textMuted}
                      />
                      <Text style={[styles.movTypeText, movType === t && styles.movTypeTextActive]}>
                        {t === 'entry' ? 'Entrada' : t === 'exit' ? 'Salida' : 'Ajuste'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Cantidad o nuevo total */}
                {movType !== 'adjustment' ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Cantidad</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>
                      Nuevo total{' '}
                      <Text style={styles.fieldHint}>(actual: {product.stock})</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={String(product.stock)}
                      placeholderTextColor={colors.textMuted}
                      value={newTotal}
                      onChangeText={setNewTotal}
                      keyboardType="numeric"
                    />
                  </View>
                )}

                {/* Motivo */}
                <Text style={styles.fieldLabel}>Motivo</Text>
                <View style={styles.reasonRow}>
                  {(movType === 'entry'
                    ? ['entry', 'other']
                    : movType === 'exit'
                    ? ['sale', 'damage', 'other']
                    : ['adjustment', 'other']
                  ).map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.reasonChip, reason === r && styles.reasonChipActive]}
                      onPress={() => setReason(r as StockMovementReason)}
                    >
                      <Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextActive]}>
                        {REASON_LABEL[r as StockMovementReason]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Notas opcionales */}
                <TextInput
                  style={styles.notesInput}
                  placeholder="Notas (opcional)"
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSaveMovement}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Registrar movimiento</Text>
                  )}
                </Pressable>

                {/* Historial */}
                <Text style={styles.histTitle}>Últimos movimientos</Text>
                {loadingMov ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
                ) : movements.length === 0 ? (
                  <Text style={styles.empty}>Sin movimientos registrados.</Text>
                ) : (
                  movements.map((m) => (
                    <View key={m.id} style={styles.movRow}>
                      <View style={[styles.movDot, { backgroundColor: m.delta >= 0 ? colors.success : colors.danger }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.movLabel}>
                          {m.delta >= 0 ? `+${m.delta}` : m.delta} uds — {REASON_LABEL[m.reason]}
                        </Text>
                        {m.notes && <Text style={styles.movNotes}>{m.notes}</Text>}
                        <Text style={styles.movDate}>{fmtDate(m.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: 20, backgroundColor: colors.background, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, paddingVertical: 14, gap: 4,
  },
  summaryCardWarn: { backgroundColor: '#FFF3E0' },
  summaryCardDanger: { backgroundColor: '#FFEBEE' },
  summaryNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTabText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  inactiveTag: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    backgroundColor: colors.border, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    alignSelf: 'flex-start', marginTop: 4,
  },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockNum: { fontSize: 20, fontWeight: '800' },
  stockUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 4 },
  panel: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16,
    gap: 12,
  },
  movTypeTabs: { flexDirection: 'row', gap: 8 },
  movTypeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  movTypeTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  movTypeText: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  movTypeTextActive: { color: '#fff' },
  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  fieldHint: { fontSize: 12, color: colors.textMuted, fontWeight: '400' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: colors.text, backgroundColor: colors.background,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background,
  },
  reasonChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  reasonChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  reasonChipTextActive: { color: '#fff' },
  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: colors.text, backgroundColor: colors.background,
    minHeight: 60,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  histTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  movRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  movDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  movLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  movNotes: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  movDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
