import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getBusinessProductIntents, updateIntentStatus } from '../../../services/productIntents';
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

function statusBadgeStyle(status: ProductIntentStatus) {
  if (status === 'sold') return { backgroundColor: '#E7F6EC' };
  if (status === 'confirmed') return { backgroundColor: '#FFF1E6' };
  if (status === 'cancelled_by_client' || status === 'cancelled_no_show' || status === 'unavailable') {
    return { backgroundColor: '#FBE8E8' };
  }
  return { backgroundColor: colors.surface };
}

function statusTextStyle(status: ProductIntentStatus) {
  if (status === 'sold') return { color: colors.success };
  if (status === 'confirmed') return { color: colors.primary };
  if (status === 'cancelled_by_client' || status === 'cancelled_no_show' || status === 'unavailable') {
    return { color: colors.danger };
  }
  return { color: colors.textMuted };
}

export default function PedidosScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [intents, setIntents] = useState<ProductIntentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  async function runIntentAction(intentId: string, status: 'sold' | 'cancelled_no_show') {
    setProcessingId(intentId);
    try {
      await updateIntentStatus(intentId, status);
      setIntents((prev) => prev.map((i) => (i.id === intentId ? { ...i, status } : i)));
    } catch (err) {
      console.error('update pedido status error', err);
      Alert.alert('Error', 'No se pudo actualizar el pedido.');
    } finally {
      setProcessingId(null);
    }
  }

  function handleAction(intentId: string, status: 'sold' | 'cancelled_no_show') {
    if (status !== 'cancelled_no_show') {
      runIntentAction(intentId, status);
      return;
    }
    Alert.alert('Cancelar venta', '¿Seguro que quieres cancelar esta venta?', [
      { text: 'No cancelar', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => runIntentAction(intentId, status) },
    ]);
  }

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
              <View style={[styles.statusBadge, statusBadgeStyle(intent.status)]}>
                <Text style={[styles.statusText, statusTextStyle(intent.status)]}>
                  {statusLabel(intent.status)}
                </Text>
              </View>
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

            {intent.status === 'confirmed' && (
              <View style={styles.actionsRow}>
                <Button
                  title="Marcar como vendido"
                  onPress={() => handleAction(intent.id, 'sold')}
                  loading={processingId === intent.id}
                  style={styles.flexButton}
                />
                <Button
                  title="Cancelar venta"
                  variant="secondary"
                  onPress={() => handleAction(intent.id, 'cancelled_no_show')}
                  loading={processingId === intent.id}
                  style={styles.flexButton}
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
});
