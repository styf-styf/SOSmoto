import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import {
  approveAppointment,
  cancelAppointment,
  getClientAppointments,
  proposeDate,
  subscribeToClientAppointments,
  type ClientAppointment,
} from '../../services/appointments';
import { syncAppointmentReminders } from '../../services/appointmentReminders';
import { getClientReportIdsByAppointments } from '../../services/serviceReports';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

function defaultCounterTime(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CitasScreen() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [reportIds, setReportIds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Contra-propuesta del cliente
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState(() => defaultCounterTime());
  const [pickerTime, setPickerTime] = useState(() => defaultCounterTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingCounter, setSavingCounter] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [result, reportMap] = await Promise.all([
      getClientAppointments(profile.id),
      getClientReportIdsByAppointments(profile.id),
    ]);
    setAppointments(result);
    setReportIds(reportMap);
    // Sincronizar recordatorios locales con las citas vigentes
    syncAppointmentReminders(
      result.map((a) => ({
        id: a.id,
        requested_at: a.requested_at,
        status: a.status,
        label: a.business_name,
        serviceName: a.service_name,
      }))
    ).catch((err) => console.warn('sync reminders error', err));
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

  function startCounter(id: string) {
    setCounteringId(id);
    const def = defaultCounterTime();
    setPickerDate(def);
    setPickerTime(def);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function cancelCounter() {
    setCounteringId(null);
  }

  function handleDateChange(event: any, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  }

  function handleTimeChange(event: any, time?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) setPickerTime(time);
  }

  async function handleApprove(id: string) {
    if (processingId) return;
    setProcessingId(id);
    try {
      await approveAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a)));
    } catch (err) {
      console.error('approve appointment error', err);
      Alert.alert('Error', 'No se pudo aprobar. Intenta de nuevo.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(id: string) {
    if (processingId) return;
    setProcessingId(id);
    try {
      await cancelAppointment(id, 'client');
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
    } catch (err) {
      console.error('cancel appointment error', err);
      Alert.alert('Error', 'No se pudo cancelar. Intenta de nuevo.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCounter(id: string) {
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);

    if (dt.getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }

    setSavingCounter(true);
    try {
      await proposeDate(id, dt.toISOString(), 'client');
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: 'scheduled', requested_at: dt.toISOString(), proposed_by: 'client' } : a
        )
      );
      setCounteringId(null);
    } catch (err) {
      console.error('counter propose error', err);
      Alert.alert('Error', 'No se pudo enviar la contra-propuesta.');
    } finally {
      setSavingCounter(false);
    }
  }

  const visibleAppointments = useMemo(() => {
    if (!selectedDate) return appointments;
    return appointments.filter(
      (a) => a.requested_at && a.requested_at.slice(0, 10) === selectedDate
    );
  }, [appointments, selectedDate]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppointmentCalendar
        appointments={appointments}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {visibleAppointments.length === 0 ? (
        <Text style={styles.placeholder}>
          {selectedDate ? 'Sin citas para este día.' : 'Todavía no has agendado ninguna cita.'}
        </Text>
      ) : (
        visibleAppointments.map((appointment) => {
          const businessProposed =
            appointment.status === 'scheduled' && appointment.proposed_by === 'business';
          const clientProposed =
            appointment.status === 'scheduled' && appointment.proposed_by === 'client';

          const reportId = reportIds.get(appointment.id);

          return (
            <View key={appointment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{appointment.business_name}</Text>
                <View style={[styles.statusBadge, statusBadgeStyle(appointment)]}>
                  <Text style={[styles.statusText, statusTextStyle(appointment)]}>
                    {statusLabel(appointment)}
                  </Text>
                </View>
              </View>

              {appointment.service_name && (
                <Text style={styles.cardMeta}>{appointment.service_name}</Text>
              )}
              {appointment.notes && <Text style={styles.cardMeta}>{appointment.notes}</Text>}

              {/* Fecha propuesta (visible en scheduled) */}
              {appointment.requested_at && (
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>
                    {businessProposed ? 'El taller propone:' : 'Tu propuesta:'}
                  </Text>
                  <Text style={styles.dateValue}>{fmtDate(appointment.requested_at)}</Text>
                </View>
              )}

              {appointment.status === 'completed' && reportId && (
                <Pressable
                  style={styles.reportBtn}
                  onPress={() => router.push(`/(client)/informe/${reportId}`)}
                >
                  <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                  <Text style={styles.reportBtnText}>Ver informe de servicio</Text>
                </Pressable>
              )}

              {/* Taller propuso → cliente aprueba o contra-propone */}
              {businessProposed && counteringId !== appointment.id && (
                <View style={styles.actionsRow}>
                  <Button
                    title="Aprobar"
                    onPress={() => handleApprove(appointment.id)}
                    style={styles.flexButton}
                    loading={processingId === appointment.id}
                    disabled={processingId !== null && processingId !== appointment.id}
                  />
                  <Button
                    title="Proponer otra"
                    variant="secondary"
                    onPress={() => startCounter(appointment.id)}
                    style={styles.flexButton}
                    disabled={processingId !== null}
                  />
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => handleCancel(appointment.id)}
                    style={styles.cancelDanger}
                    disabled={processingId !== null}
                  />
                </View>
              )}

              {/* Formulario de contra-propuesta del cliente */}
              {counteringId === appointment.id && (
                <View style={styles.counterBox}>
                  <Text style={styles.counterTitle}>Proponer otra fecha</Text>

                  <Text style={styles.fieldLabel}>Fecha</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => setShowDatePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {pickerDate.toLocaleDateString('es-EC', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                  {showDatePicker && (
                    <DateTimePicker
                      value={pickerDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                      minimumDate={new Date()}
                      onChange={handleDateChange}
                    />
                  )}

                  <Text style={styles.fieldLabel}>Hora</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => setShowTimePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {pickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {showTimePicker && (
                    <DateTimePicker
                      value={pickerTime}
                      mode="time"
                      display="spinner"
                      onChange={handleTimeChange}
                    />
                  )}

                  <View style={styles.actionsRow}>
                    <Button
                      title="Enviar propuesta"
                      onPress={() => handleCounter(appointment.id)}
                      loading={savingCounter}
                      style={styles.flexButton}
                    />
                    <Button
                      title="Cancelar"
                      variant="secondary"
                      onPress={cancelCounter}
                      style={styles.flexButton}
                    />
                  </View>
                </View>
              )}

              {/* Cliente propuso → esperando respuesta del taller */}
              {clientProposed && counteringId !== appointment.id && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>Esperando respuesta del taller.</Text>
                  <Button
                    title="Cancelar cita"
                    variant="secondary"
                    onPress={() => handleCancel(appointment.id)}
                    style={styles.cancelButton}
                    loading={processingId === appointment.id}
                    disabled={processingId !== null && processingId !== appointment.id}
                  />
                </View>
              )}

              {/* Sin fecha aún → esperando que el taller proponga */}
              {appointment.status === 'pending' && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>El taller elegirá una fecha y te avisará.</Text>
                  <Button
                    title="Cancelar cita"
                    variant="secondary"
                    onPress={() => handleCancel(appointment.id)}
                    style={styles.cancelButton}
                    loading={processingId === appointment.id}
                    disabled={processingId !== null && processingId !== appointment.id}
                  />
                </View>
              )}

              {appointment.status === 'confirmed' && (
                <View style={styles.actionsRow}>
                  <Button
                    title="Proponer otro horario"
                    variant="secondary"
                    onPress={() => startCounter(appointment.id)}
                    style={styles.flexButton}
                  />
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => handleCancel(appointment.id)}
                    style={styles.flexButton}
                    loading={processingId === appointment.id}
                    disabled={processingId !== null && processingId !== appointment.id}
                  />
                </View>
              )}
            </View>
          );
        }))
      }
    </ScrollView>
  );
}

function statusLabel(a: ClientAppointment): string {
  if (a.status === 'pending') return 'Esperando fecha del taller';
  if (a.status === 'scheduled' && a.proposed_by === 'business') return 'El taller propuso una fecha';
  if (a.status === 'scheduled' && a.proposed_by === 'client') return 'Propuesta enviada';
  if (a.status === 'confirmed') return 'Confirmada';
  if (a.status === 'rejected') return 'Rechazada';
  if (a.status === 'cancelled') return 'Cancelada';
  if (a.status === 'completed') return 'Completada';
  return a.status;
}

function statusBadgeStyle(a: ClientAppointment) {
  if (a.status === 'confirmed') return { backgroundColor: '#E7F6EC' };
  if (a.status === 'scheduled' && a.proposed_by === 'business') return { backgroundColor: '#FFF1E6' };
  if (a.status === 'rejected' || a.status === 'cancelled') return { backgroundColor: '#FBE8E8' };
  return { backgroundColor: colors.surface };
}

function statusTextStyle(a: ClientAppointment) {
  if (a.status === 'confirmed') return { color: colors.success };
  if (a.status === 'scheduled' && a.proposed_by === 'business') return { color: colors.primary };
  if (a.status === 'rejected' || a.status === 'cancelled') return { color: colors.danger };
  return { color: colors.textMuted };
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
  dateRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
  waitingRow: {
    marginTop: 10,
    gap: 8,
  },
  waitingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  cancelButton: {
    marginTop: 4,
  },
  cancelDanger: {
    flex: 1,
    borderColor: colors.danger,
  },
  counterBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  counterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  pickerButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reportBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
