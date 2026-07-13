import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { InfoButton, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
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

// Componente estable (definido una sola vez, no dentro del .map de la
// pantalla) -- si se recreara por cada tarjeta en cada render, React lo
// trataría como un tipo de componente distinto cada vez y desmontaría/
// remontaría toda la tarjeta en cada interacción en vez de reconciliarla.
function AppointmentCard({
  pressable,
  onPress,
  children,
}: {
  pressable: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  if (pressable) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

interface CitasData {
  appointments: ClientAppointment[];
  reportIds: Map<string, string>;
}

export default function CitasScreen() {
  const { profile } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Contra-propuesta del cliente
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState(() => defaultCounterTime());
  const [pickerTime, setPickerTime] = useState(() => defaultCounterTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingCounter, setSavingCounter] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const cacheKey = profile ? `citas-${profile.id}` : null;
  const { data, loading, reload, setData: setCitasData } = useCachedLoad<CitasData>(cacheKey, async () => {
    if (!profile) return { appointments: [], reportIds: new Map() };
    const [result, reportMap] = await Promise.all([
      getClientAppointments(profile.id),
      getClientReportIdsByAppointments(profile.id),
    ]);
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
    return { appointments: result, reportIds: reportMap };
  });
  const appointments = data?.appointments ?? [];
  const reportIds = data?.reportIds ?? new Map<string, string>();

  function setAppointments(updater: (prev: ClientAppointment[]) => ClientAppointment[]) {
    setCitasData((prev) => ({
      appointments: updater(prev?.appointments ?? []),
      reportIds: prev?.reportIds ?? new Map(),
    }));
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load citas error', err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    // Un cambio real notificado por el servidor SÍ amerita recargar (no es
    // un "por si acaso" al revisitar la pantalla, es un cambio confirmado).
    const unsubscribe = subscribeToClientAppointments(profile.id, () => {
      reload().catch((err) => console.error('reload citas error', err));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Tus citas</Text>
        <InfoButton onPress={() => setShowInfo(true)} accessibilityLabel="Cómo funciona el flujo de citas" size={20} />
      </View>

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
          const canOpenReport = appointment.status === 'completed' && !!reportId;

          return (
            <AppointmentCard
              key={appointment.id}
              pressable={canOpenReport}
              onPress={canOpenReport ? () => router.push(`/(client)/informe/${reportId}`) : undefined}
            >
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

              {appointment.status === 'completed' && (
                reportId ? (
                  <Pressable
                    style={styles.reportBtn}
                    onPress={() => router.push(`/(client)/informe/${reportId}`)}
                  >
                    <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                    <Text style={styles.reportBtnText}>Ver informe de servicio</Text>
                  </Pressable>
                ) : (
                  <View style={styles.reportBtn}>
                    <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.reportPendingText}>Informe pendiente</Text>
                  </View>
                )
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
            </AppointmentCard>
          );
        }))
      }

      <InfoModal visible={showInfo} title="Cómo funciona el flujo de citas" onClose={() => setShowInfo(false)}>
        <InfoStep number={1} title="Pides una cita">
          <Text style={infoTextStyles.text}>
            Desde el perfil del taller, eliges el servicio y, si quieres, sugieres fecha y hora. Se abre un chat con
            el taller donde queda registrada tu solicitud.
          </Text>
        </InfoStep>

        <InfoStep number={2} title="El taller elige o confirma la fecha">
          <Text style={infoTextStyles.text}>
            Si no sugeriste fecha, verás "Esperando fecha del taller" hasta que la propongan. Si sugeriste una y el
            taller la acepta tal cual, pasa directo a "Confirmada".
          </Text>
        </InfoStep>

        <InfoStep number={3} title="Si el taller propone otra fecha">
          <Text style={infoTextStyles.text}>
            Verás "El taller propuso una fecha" con tres opciones: "Aprobar" (queda Confirmada), "Proponer otra" (tu
            contrapropuesta) o "Cancelar".
          </Text>
        </InfoStep>

        <InfoStep number={4} title="El ida y vuelta de propuestas">
          <Text style={infoTextStyles.text}>
            Cada vez que uno de los dos propone una fecha nueva, la cita queda "esperando respuesta" del otro lado
            hasta que alguien apruebe -- no hay límite de rondas, pueden proponer y contraproponer las veces que hagan
            falta.
          </Text>
        </InfoStep>

        <InfoStep number={5} title="Confirmada = ambos de acuerdo">
          <Text style={infoTextStyles.text}>
            Una vez confirmada, todavía puedes tocar "Proponer otro horario" si algo cambia, o cancelar la cita.
          </Text>
        </InfoStep>

        <InfoStep number={6} title="Al completar, revisa el informe de servicio">
          <Text style={infoTextStyles.text}>
            Si el taller generó un informe de lo que hizo, podrás abrirlo tocando la tarjeta de la cita completada.
          </Text>
        </InfoStep>
      </InfoModal>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
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
  cardPressed: {
    opacity: 0.75,
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
  reportPendingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
