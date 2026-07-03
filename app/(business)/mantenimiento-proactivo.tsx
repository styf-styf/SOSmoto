import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getClientsWithUpcomingMaintenance, type ClientMaintenanceItem } from '../../services/maintenanceOutreach';
import { notifyUser } from '../../services/notifications';

export default function MantenimientoProactivoScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ClientMaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    const data = await getClientsWithUpcomingMaintenance(work.business.id);
    setItems(data);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load mantenimiento proactivo error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handleNotify(item: ClientMaintenanceItem) {
    setNotifying(item.suggestionId);
    try {
      await notifyUser(
        item.clientId,
        'Recordatorio de mantenimiento',
        `Tu ${item.vehicleLabel} necesita: ${item.serviceName}. ¡Agenda con nosotros!`,
        { type: 'maintenance_reminder', vehicleId: item.vehicleId }
      );
      Alert.alert('Aviso enviado', `Se notificó a ${item.clientName} sobre el ${item.serviceName}.`);
    } catch (err) {
      console.error('notify client maintenance error', err);
      Alert.alert('Error', 'No se pudo enviar el aviso.');
    } finally {
      setNotifying(null);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Clientes que ya han visitado tu taller y tienen mantenimiento próximo o vencido. Envíales un recordatorio.
      </Text>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            Ninguno de tus clientes tiene mantenimiento pendiente por ahora.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.suggestionId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.clientName}>{item.clientName}</Text>
              {item.isDue ? (
                <View style={styles.badgeDue}>
                  <Text style={styles.badgeText}>Vencido</Text>
                </View>
              ) : (
                <View style={styles.badgeSoon}>
                  <Text style={styles.badgeText}>Próximo</Text>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.meta}>
                {item.vehicleLabel} · {item.vehicleMileage.toLocaleString()} km actuales
              </Text>
            </View>

            <View style={styles.row}>
              <Ionicons name="construct-outline" size={14} color={colors.textMuted} />
              <Text style={styles.meta}>
                {item.serviceName}
                {item.isDue
                  ? ` · vencido hace ${Math.abs(item.kmRemaining).toLocaleString()} km`
                  : ` · faltan ${item.kmRemaining.toLocaleString()} km`}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                disabled={notifying === item.suggestionId}
                onPress={() => handleNotify(item)}
              >
                {notifying === item.suggestionId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="notifications-outline" size={16} color="#fff" />
                )}
                <Text style={styles.actionBtnTextWhite}>Avisar</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => router.push(`/(business)/chat/${item.clientId}`)}
              >
                <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                <Text style={styles.actionBtnText}>Chat</Text>
              </Pressable>

              {item.clientPhone && (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() =>
                    Linking.openURL(`https://wa.me/${item.clientPhone?.replace(/\D/g, '')}`)
                  }
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.actionBtnText}>WhatsApp</Text>
                </Pressable>
              )}
            </View>
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
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
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
    maxWidth: 280,
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
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  badgeDue: {
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeSoon: {
    backgroundColor: '#FFF1E6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnTextWhite: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
