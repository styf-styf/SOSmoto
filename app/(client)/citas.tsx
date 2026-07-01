import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import {
  approveAppointment,
  cancelAppointment,
  getClientAppointments,
  rejectAppointment,
  requestReschedule,
  subscribeToClientAppointments,
  type ClientAppointment,
} from '../../services/appointments';

const statusLabel: Record<ClientAppointment['status'], string> = {
  pending: 'Esperando que el taller agende',
  scheduled: 'Fecha propuesta, por aprobar',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const statusColor: Record<ClientAppointment['status'], string> = {
  pending: colors.warning,
  scheduled: colors.warning,
  confirmed: colors.success,
  rejected: colors.danger,
  cancelled: colors.textMuted,
  completed: colors.textMuted,
};

export default function CitasScreen() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const result = await getClientAppointments(profile.id);
    setAppointments(result);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load citas error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToClientAppointments(profile.id, () => {
      load().catch((err) => console.error('reload citas error', err));
    });
    return unsubscribe;
  }, [profile, load]);

  async function handleCancel(id: string) {
    try {
      await cancelAppointment(id, 'client');
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
    } catch (err) {
      console.error('cancel appointment error', err);
    }
  }

  async function handleReschedule(id: string) {
    try {
      await requestReschedule(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'pending', requested_at: null } : a))
      );
    } catch (err) {
      console.error('request reschedule error', err);
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a)));
    } catch (err) {
      console.error('approve appointment error', err);
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
    } catch (err) {
      console.error('reject appointment error', err);
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
      {appointments.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has agendado ninguna cita.</Text>
      ) : (
        appointments.map((appointment) => (
          <View key={appointment.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{appointment.business_name}</Text>
              <Text style={[styles.statusBadge, { color: statusColor[appointment.status] }]}>
                {statusLabel[appointment.status]}
              </Text>
            </View>
            {appointment.requested_at && (
              <Text style={styles.cardMeta}>
                {new Date(appointment.requested_at).toLocaleString('es-EC', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            )}
            {appointment.service_name && <Text style={styles.cardMeta}>{appointment.service_name}</Text>}
            {appointment.notes && <Text style={styles.cardMeta}>{appointment.notes}</Text>}

            {appointment.status === 'scheduled' && (
              <View style={styles.actionsRow}>
                <Button title="Aprobar" onPress={() => handleApprove(appointment.id)} style={styles.flexButton} />
                <Button
                  title="Rechazar"
                  variant="secondary"
                  onPress={() => handleReject(appointment.id)}
                  style={styles.flexButton}
                />
              </View>
            )}

            {appointment.status === 'pending' && (
              <Button
                title="Cancelar cita"
                variant="secondary"
                onPress={() => handleCancel(appointment.id)}
                style={styles.cancelButton}
              />
            )}

            {appointment.status === 'confirmed' && (
              <View style={styles.actionsRow}>
                <Button
                  title="Reagendar"
                  variant="secondary"
                  onPress={() => handleReschedule(appointment.id)}
                  style={styles.flexButton}
                />
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => handleCancel(appointment.id)}
                  style={styles.flexButton}
                />
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
});
