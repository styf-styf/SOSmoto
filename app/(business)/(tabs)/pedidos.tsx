import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { CircleActionButton } from '../../../components/CircleActionButton';
import { StatusBadge, type StatusBadgeTone } from '../../../components/StatusBadge';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useProductIntentAction } from '../../../hooks/useProductIntentAction';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getBusinessProductIntents } from '../../../services/productIntents';
import { toWhatsappLink } from '../../../utils/whatsapp';
import type { ProductIntentWithDetails, ProductIntentStatus } from '../../../types/database';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtPrice(price: number | null) {
  return price != null ? `$${price.toFixed(2)}` : null;
}

function statusLabel(status: ProductIntentStatus): string {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'confirmed': return 'Apartado';
    case 'sold': return 'Vendido';
    case 'unavailable': return 'No disponible';
    case 'cancelled_by_client': return 'Cancelado por cliente';
    case 'cancelled_no_show': return 'No retirado';
    default: return status;
  }
}

function statusTone(status: ProductIntentStatus): StatusBadgeTone {
  if (status === 'sold') return 'success';
  if (status === 'confirmed') return 'pending';
  if (status === 'cancelled_by_client' || status === 'cancelled_no_show' || status === 'unavailable') {
    return 'danger';
  }
  return 'neutral';
}

export default function PedidosScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [intents, setIntents] = useState<ProductIntentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { processingId, handleAction } = useProductIntentAction(setIntents);

  const load = useCallback(async (id: string) => {
    const result = await getBusinessProductIntents(id);
    setIntents(result);
  }, []);

  async function handleRefresh() {
    if (!businessId) return;
    setRefreshing(true);
    try { await load(businessId); } finally { setRefreshing(false); }
  }

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getMyWorkBusiness(profile.id)
      .then((work) => {
        if (!work) return;
        setBusinessId(work.business.id);
        return load(work.business.id);
      })
      .catch((err) => console.error('load pedidos error', err))
      .finally(() => setLoading(false));
  }, [profile, load]);

  useFocusEffect(
    useCallback(() => {
      if (!businessId) return;
      load(businessId).catch((err) => console.error('reload pedidos on focus', err));
    }, [businessId, load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!businessId) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea o únete a un negocio.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {intents.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no tienes pedidos.</Text>
      ) : (
        intents.map((intent) => (
          <Pressable
            key={intent.id}
            style={styles.card}
            onPress={() => router.push(`/(business)/cliente/${intent.client_id}?highlightIntentId=${intent.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                {intent.client_avatar_url ? (
                  <Image source={{ uri: intent.client_avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={18} color={colors.textMuted} />
                )}
              </View>
              <Text style={styles.cardTitle}>{intent.buyer_business_name ?? intent.client_name}</Text>
              <StatusBadge label={statusLabel(intent.status)} tone={statusTone(intent.status)} />
            </View>

            <Text style={styles.cardMeta}>
              {intent.quantity > 1 ? `${intent.quantity} × ` : ''}{intent.product_name}
              {intent.product_price != null ? ` · ${fmtPrice(intent.product_price * intent.quantity)}` : ''}
            </Text>
            <Text style={styles.cardMeta}>{fmtDate(intent.created_at)}</Text>

            {intent.client_phone && (
              <Pressable
                style={styles.phoneRow}
                onPress={() => Linking.openURL(toWhatsappLink(intent.client_phone))}
              >
                <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                <Text style={styles.phoneText}>{intent.client_phone}</Text>
              </Pressable>
            )}

            {intent.status === 'pending' && (
              <View style={styles.circleActionsRow}>
                <CircleActionButton
                  icon="close"
                  label="No disponible"
                  color={colors.danger}
                  onPress={() => handleAction(intent.id, 'unavailable')}
                  loading={processingId === intent.id}
                />
                <CircleActionButton
                  icon="checkmark"
                  label="Confirmar"
                  color={colors.primary}
                  onPress={() => handleAction(intent.id, 'confirmed')}
                  loading={processingId === intent.id}
                />
              </View>
            )}

            {intent.status === 'confirmed' && (
              <View style={styles.circleActionsRow}>
                <CircleActionButton
                  icon="close"
                  label="Cancelar venta"
                  color={colors.danger}
                  variant="outline"
                  onPress={() => handleAction(intent.id, 'cancelled_no_show')}
                  loading={processingId === intent.id}
                />
                <CircleActionButton
                  icon="checkmark"
                  label="Vendido"
                  color={colors.primary}
                  onPress={() => handleAction(intent.id, 'sold')}
                  loading={processingId === intent.id}
                />
              </View>
            )}
          </Pressable>
        ))
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
    paddingTop: 36,
    paddingBottom: 20,
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  phoneText: {
    fontSize: 13,
    color: colors.text,
  },
  circleActionsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
});
