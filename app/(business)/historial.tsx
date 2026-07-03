import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getBusinessHistory, type HistoryItem } from '../../services/history';
import { formatVehicle } from '../../types/database';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HistorialScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    const history = await getBusinessHistory(work.business.id);
    setItems(history);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load historial error', err))
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Aún no hay trabajos completados.</Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/(business)/cliente/${item.clientId}`)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.badge, item.type === 'aid' ? styles.badgeAid : styles.badgeAppt]}>
                <Text style={styles.badgeText}>{item.type === 'aid' ? 'Auxilio' : 'Cita'}</Text>
              </View>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            </View>

            <Text style={styles.clientName}>{item.clientName}</Text>

            {item.vehicle && (
              <View style={styles.row}>
                <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.meta}>{formatVehicle(item.vehicle)}</Text>
              </View>
            )}

            {item.description && (
              <View style={styles.row}>
                <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
              </View>
            )}

            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
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
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  chevronWrap: {
    position: 'absolute',
    right: 16,
    top: '50%',
  },
});
