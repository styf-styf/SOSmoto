import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getClientProfileForBusiness, getBusinessHistory, type HistoryItem, type ClientProfileForBusiness } from '../../../services/history';
import { formatVehicle } from '../../../types/database';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [client, setClient] = useState<ClientProfileForBusiness | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [work, clientProfile] = await Promise.all([
      getMyWorkBusiness(profile.id),
      getClientProfileForBusiness(id),
    ]);
    if (!work || !clientProfile) return;
    setBusinessId(work.business.id);
    setClient(clientProfile);
    const items = await getBusinessHistory(work.business.id, { clientId: id });
    setHistory(items);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load cliente detail error', err))
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

  if (!client) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Cliente no encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header del cliente */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={32} color={colors.textMuted} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.clientName}>{client.full_name}</Text>
          {client.phone && (
            <Text style={styles.clientPhone}>{client.phone}</Text>
          )}
        </View>
      </View>

      {/* Acciones rápidas */}
      <View style={styles.actionsRow}>
        {client.phone && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${client.phone}`)}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Llamar</Text>
          </Pressable>
        )}
        {client.phone && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => Linking.openURL(`https://wa.me/${client.phone?.replace(/\D/g, '')}`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/(business)/chat/${id}`)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
          <Text style={styles.actionLabel}>Chat</Text>
        </Pressable>
      </View>

      {/* Vehículos */}
      {client.vehicles.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Vehículos</Text>
          {client.vehicles.map((v) => (
            <View key={v.id} style={styles.vehicleCard}>
              <Ionicons name="bicycle" size={20} color={colors.primary} style={styles.vehicleIcon} />
              <View>
                <Text style={styles.vehicleLabel}>{v.brand} {v.model} {v.year}</Text>
                <Text style={styles.vehicleMeta}>{v.current_mileage.toLocaleString()} km</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Historial de interacciones */}
      <Text style={styles.sectionTitle}>Historial contigo</Text>
      {history.length === 0 ? (
        <Text style={styles.placeholder}>Sin interacciones registradas.</Text>
      ) : (
        history.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={[styles.badge, item.type === 'aid' ? styles.badgeAid : styles.badgeAppt]}>
                <Text style={styles.badgeText}>{item.type === 'aid' ? 'Auxilio' : 'Cita'}</Text>
              </View>
              <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
            </View>
            {item.vehicle && (
              <Text style={styles.historyMeta}>
                <Ionicons name="bicycle-outline" size={12} /> {formatVehicle(item.vehicle)}
              </Text>
            )}
            {item.description && (
              <Text style={styles.historyDesc} numberOfLines={2}>{item.description}</Text>
            )}
          </View>
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
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  clientPhone: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  vehicleIcon: {
    marginRight: 2,
  },
  vehicleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  vehicleMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeAid: {
    backgroundColor: '#FFF1E6',
  },
  badgeAppt: {
    backgroundColor: '#E8F0FF',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  historyDesc: {
    fontSize: 14,
    color: colors.text,
  },
  placeholder: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
