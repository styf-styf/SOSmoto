import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { createReview } from '../../services/reviews';
import { getMyProductPurchases, type MyProductPurchase } from '../../services/productIntents';
import type { ProductIntentStatus } from '../../types/database';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status: ProductIntentStatus): string {
  switch (status) {
    case 'pending': return 'Esperando confirmación';
    case 'confirmed': return 'Confirmado — listo para retirar';
    case 'sold': return 'Comprado';
    case 'unavailable': return 'No disponible';
    case 'cancelled_by_client': return 'Cancelaste este apartado';
    case 'cancelled_no_show': return 'Cancelado por el negocio';
    default: return status;
  }
}

function statusBadgeStyle(status: ProductIntentStatus) {
  if (status === 'sold') return { backgroundColor: '#E7F6EC' };
  if (status === 'confirmed' || status === 'pending') return { backgroundColor: '#FFF1E6' };
  return { backgroundColor: '#FBE8E8' };
}

function statusTextStyle(status: ProductIntentStatus) {
  if (status === 'sold') return { color: colors.success };
  if (status === 'confirmed' || status === 'pending') return { color: colors.primary };
  return { color: colors.danger };
}

export default function MisComprasScreen() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<MyProductPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const result = await getMyProductPurchases(profile.id);
    setPurchases(result);
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load mis compras error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('load mis compras error', err));
      }
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {purchases.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has apartado ningún producto.</Text>
      ) : (
        purchases.map((purchase) => (
          <PurchaseCard key={purchase.id} purchase={purchase} onReviewed={load} />
        ))
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PurchaseCard({ purchase, onReviewed }: { purchase: MyProductPurchase; onReviewed: () => void }) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!profile) return;
    setSaving(true);
    try {
      await createReview({
        reviewerId: profile.id,
        businessId: purchase.businessId,
        productIntentId: purchase.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setShowForm(false);
      onReviewed();
    } catch (err) {
      console.error('create review error', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/(client)/producto/${purchase.productId}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{purchase.businessName}</Text>
        <View style={[styles.statusBadge, statusBadgeStyle(purchase.status)]}>
          <Text style={[styles.statusText, statusTextStyle(purchase.status)]}>
            {statusLabel(purchase.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {purchase.quantity > 1 ? `${purchase.quantity} × ` : ''}{purchase.productName}
        {purchase.productPrice != null ? ` · $${(purchase.productPrice * purchase.quantity).toFixed(2)}` : ''}
      </Text>
      <Text style={styles.cardMeta}>{fmtDate(purchase.updatedAt)}</Text>

      {purchase.status === 'sold' && (
        purchase.review ? (
          <View style={styles.reviewDone}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.reviewDoneText}>Calificaste con {purchase.review.rating} estrellas</Text>
          </View>
        ) : showForm ? (
          <View style={styles.reviewForm}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)}>
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={24}
                    color={colors.warning}
                  />
                </Pressable>
              ))}
            </View>
            <TextField label="Comentario (opcional)" value={comment} onChangeText={setComment} />
            <View style={styles.actionsRow}>
              <Button title="Enviar" onPress={handleSubmit} loading={saving} style={styles.flexButton} />
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setShowForm(false)}
                style={styles.flexButton}
              />
            </View>
          </View>
        ) : (
          <Button title="Calificar" variant="secondary" onPress={() => setShowForm(true)} style={styles.reviewButton} />
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reviewDoneText: {
    fontSize: 13,
    color: colors.text,
  },
  reviewForm: {
    marginTop: 12,
  },
  reviewButton: {
    marginTop: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
