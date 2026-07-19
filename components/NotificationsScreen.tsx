import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { getMyNotifications, markAllNotificationsRead, type AppNotification } from '../services/notifications';
import { formatConversationTimestamp } from '../utils/chatFormat';

// Traduce el `data.type` guardado por notifyUser() (services/notifications.ts)
// a una pantalla real -- algunos tipos los recibe tanto cliente como negocio
// con significados distintos (ej. "message"), por eso el `role` del visor
// importa. Cuando no hay pantalla de detalle para el ítem puntual (ej. no
// existe una vista de "una sola cita"), se manda a la sección general
// correspondiente (Mis citas / Agenda) en vez de no hacer nada.
function resolveNotificationRoute(notification: AppNotification, role: 'client' | 'business'): string | null {
  const data = (notification.data ?? {}) as Record<string, string | undefined>;
  const type = data.type;
  if (!type) return null;

  switch (type) {
    case 'help_request':
    case 'help_request_cancelled_by_client':
      return '/(business)/(tabs)/solicitudes';
    case 'help_request_accepted':
    case 'help_request_reopened':
      return '/(client)/(tabs)/auxilio';
    case 'help_request_completed':
      return role === 'business' ? '/(business)/(tabs)/solicitudes' : '/(client)/(tabs)/auxilio';

    case 'appointment_scheduled':
    case 'appointment_rejected':
      return '/(client)/citas';
    case 'appointment_reschedule_requested':
    case 'appointment_requested':
      return '/(business)/agenda-negocio';
    case 'appointment_approved':
    case 'appointment_cancelled':
    case 'appointment_reminder':
      return role === 'business' ? '/(business)/agenda-negocio' : '/(client)/citas';

    case 'employee_invitation':
    case 'business_invitation':
      return '/(client)/invitaciones';
    case 'employee_invitation_accepted':
    case 'employee_invitation_rejected':
      return '/(business)/empleados';

    case 'product_intent':
      if (!data.productId) return null;
      return role === 'business' ? `/(business)/producto/${data.productId}` : `/(client)/producto/${data.productId}`;
    case 'service_intent':
      if (!data.serviceId) return null;
      return role === 'business' ? `/(business)/servicio/${data.serviceId}` : `/(client)/servicio/${data.serviceId}`;
    case 'rate_business':
      return data.businessId ? `/(client)/business/${data.businessId}` : null;
    case 'service_report':
      if (!data.reportId) return null;
      return role === 'business' ? `/(business)/informe/${data.reportId}` : `/(client)/informe/${data.reportId}`;
    case 'new_review':
      return '/(business)/estadisticas';
    case 'message':
      if (role === 'business') return data.clientId ? `/(business)/chat/${data.clientId}` : null;
      return data.businessId ? `/(client)/chat/${data.businessId}` : null;
    default:
      return null;
  }
}

// Bandeja de notificaciones -- misma pantalla para cliente y negocio (la
// lógica de carga es idéntica, solo cambia `role` para resolver a qué
// pantalla lleva cada tipo). Ver app/(client)/notificaciones.tsx y
// app/(business)/notificaciones.tsx, los wrappers finos que la registran en
// cada Stack y le pasan su `role`.
export function NotificationsScreen({ role }: { role: 'client' | 'business' }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setNotifications(await getMyNotifications(profile.id));
    // Se marcan como leídas apenas se abre la bandeja -- el indicador en la
    // campanita del perfil desaparece la próxima vez que esa pantalla revise
    // el conteo (al recuperar el foco).
    markAllNotificationsRead(profile.id).catch((err) => console.error('mark notifications read error', err));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load notifications error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('refresh notifications error', err));
      }
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error('pull to refresh notifications error', err);
    } finally {
      setRefreshing(false);
    }
  }

  function handlePress(notification: AppNotification) {
    const route = resolveNotificationRoute(notification, role);
    if (route) router.push(route as any);
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
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
          <Text style={styles.placeholder}>Todavía no tienes notificaciones.</Text>
        </View>
      ) : (
        notifications.map((n) => {
          const hasTarget = !!resolveNotificationRoute(n, role);
          return (
            <Pressable
              key={n.id}
              style={styles.row}
              onPress={() => handlePress(n)}
              disabled={!hasTarget}
            >
              <View style={styles.icon}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.rowBody}>{n.body}</Text>
                <Text style={styles.rowTime}>{formatConversationTimestamp(n.created_at)}</Text>
              </View>
              {hasTarget && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </Pressable>
          );
        })
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
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowBody: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
