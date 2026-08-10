import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CircleActionButton } from '../../components/CircleActionButton';
import { StatusBadge, type StatusBadgeTone } from '../../components/StatusBadge';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { InfoButton, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import {
  cancelAppointment,
  getClientAppointments,
  subscribeToClientAppointments,
  type ClientAppointment,
} from '../../services/appointments';
import {
  getClientAppointmentRequests,
  subscribeToClientAppointmentRequests,
  type ClientAppointmentRequest,
} from '../../services/appointmentRequests';
import { useClientAppointmentRequestCancel } from '../../hooks/useClientAppointmentRequestCancel';
import { useAppointmentRescheduleActions } from '../../hooks/useAppointmentRescheduleActions';
import { syncAppointmentReminders } from '../../services/appointmentReminders';
import { getClientReportIdsByAppointments } from '../../services/serviceReports';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  requests: ClientAppointmentRequest[];
  reportIds: Map<string, string>;
}

export default function CitasScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const cacheKey = profile ? `citas-${profile.id}` : null;
  const { data, loading, reload, setData: setCitasData } = useCachedLoad<CitasData>(cacheKey, async () => {
    if (!profile) return { appointments: [], requests: [], reportIds: new Map() };
    const [result, requests, reportMap] = await Promise.all([
      getClientAppointments(profile.id),
      getClientAppointmentRequests(profile.id),
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
    return { appointments: result, requests, reportIds: reportMap };
  });
  const appointments = data?.appointments ?? [];
  const requests = data?.requests ?? [];
  const reportIds = data?.reportIds ?? new Map<string, string>();

  function setAppointments(updater: (prev: ClientAppointment[]) => ClientAppointment[]) {
    setCitasData((prev) => ({
      appointments: updater(prev?.appointments ?? []),
      requests: prev?.requests ?? [],
      reportIds: prev?.reportIds ?? new Map(),
    }));
  }

  const rescheduleActions = useAppointmentRescheduleActions('client', (id, patch) =>
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  );

  function setRequests(updater: (prev: ClientAppointmentRequest[]) => ClientAppointmentRequest[]) {
    setCitasData((prev) => ({
      appointments: prev?.appointments ?? [],
      requests: updater(prev?.requests ?? []),
      reportIds: prev?.reportIds ?? new Map(),
    }));
  }

  const { cancellingRequestId, cancelRequest } = useClientAppointmentRequestCancel<ClientAppointmentRequest>(setRequests);

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

  // Solicitudes (appointment_requests, todavía sin fila en appointments) --
  // suscripción aparte porque viven en una tabla distinta.
  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToClientAppointmentRequests(profile.id, () => {
      reload().catch((err) => console.error('reload citas error', err));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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

      {requests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>Solicitudes enviadas</Text>
          {requests.map((request) => (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{request.business_name}</Text>
                <StatusBadge label="Esperando respuesta del taller" tone="pending" />
              </View>
              {request.service_name && <Text style={styles.cardMeta}>{request.service_name}</Text>}
              {request.notes && <Text style={styles.cardMeta}>{request.notes}</Text>}
              <View style={styles.circleActionsRow}>
                <CircleActionButton
                  icon="close"
                  label="Cancelar solicitud"
                  color={colors.danger}
                  onPress={() => cancelRequest(request)}
                  loading={cancellingRequestId === request.id}
                  disabled={cancellingRequestId !== null && cancellingRequestId !== request.id}
                />
              </View>
            </View>
          ))}
        </View>
      )}

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
                <StatusBadge label={statusLabel(appointment)} tone={statusTone(appointment)} />
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
              {businessProposed && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Cancelar"
                    color={colors.danger}
                    onPress={() => handleCancel(appointment.id)}
                    disabled={processingId !== null}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer otra"
                    color={colors.primary}
                    variant="outline"
                    onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                    disabled={processingId !== null}
                  />
                  <CircleActionButton
                    icon="checkmark"
                    label="Aprobar"
                    color={colors.primary}
                    onPress={() => rescheduleActions.approve(appointment.id)}
                    loading={rescheduleActions.approvingId === appointment.id}
                    disabled={rescheduleActions.approvingId !== null && rescheduleActions.approvingId !== appointment.id}
                  />
                </View>
              )}

              {/* Formulario de contra-propuesta del cliente */}
              {rescheduleActions.reschedulingId === appointment.id && (
                <View style={styles.counterBox}>
                  <Text style={styles.counterTitle}>Proponer otra fecha</Text>

                  <Text style={styles.fieldLabel}>Fecha</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => rescheduleActions.setShowDatePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {rescheduleActions.pickerDate.toLocaleDateString('es-EC', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                  {rescheduleActions.showDatePicker && (
                    <DateTimePicker
                      value={rescheduleActions.pickerDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                      minimumDate={new Date()}
                      onChange={rescheduleActions.handleDateChange}
                    />
                  )}

                  <Text style={styles.fieldLabel}>Hora</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => rescheduleActions.setShowTimePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {rescheduleActions.pickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {rescheduleActions.showTimePicker && (
                    <DateTimePicker
                      value={rescheduleActions.pickerTime}
                      mode="time"
                      display="spinner"
                      onChange={rescheduleActions.handleTimeChange}
                    />
                  )}

                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="close"
                      label="Cancelar"
                      color={colors.textMuted}
                      variant="outline"
                      onPress={rescheduleActions.cancelRescheduling}
                    />
                    <CircleActionButton
                      icon="checkmark"
                      label="Enviar propuesta"
                      color={colors.primary}
                      loading={rescheduleActions.saving}
                      onPress={() => rescheduleActions.confirmReschedule(appointment.id)}
                    />
                  </View>
                </View>
              )}

              {/* Cliente propuso → esperando respuesta del taller */}
              {clientProposed && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>Esperando respuesta del taller.</Text>
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="close"
                      label="Cancelar cita"
                      color={colors.danger}
                      onPress={() => handleCancel(appointment.id)}
                      loading={processingId === appointment.id}
                      disabled={processingId !== null && processingId !== appointment.id}
                    />
                  </View>
                </View>
              )}

              {/* Sin fecha aún → esperando que el taller proponga */}
              {appointment.status === 'pending' && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>El taller elegirá una fecha y te avisará.</Text>
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="close"
                      label="Cancelar cita"
                      color={colors.danger}
                      onPress={() => handleCancel(appointment.id)}
                      loading={processingId === appointment.id}
                      disabled={processingId !== null && processingId !== appointment.id}
                    />
                  </View>
                </View>
              )}

              {appointment.status === 'confirmed' && (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Cancelar"
                    color={colors.danger}
                    onPress={() => handleCancel(appointment.id)}
                    loading={processingId === appointment.id}
                    disabled={processingId !== null && processingId !== appointment.id}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer otro horario"
                    color={colors.primary}
                    variant="outline"
                    onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                    disabled={processingId !== null}
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
            el taller donde queda registrada tu solicitud, y aparece acá arriba en "Solicitudes enviadas" mientras
            esperas respuesta.
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
  // proposed_by debería ser siempre 'business' o 'client' junto con
  // 'scheduled' (lo fija proposeDate()), pero datos viejos de prueba lo
  // dejaron en null -- sin este fallback se mostraba el valor crudo del
  // enum ("scheduled") en la tarjeta en vez de un texto traducido.
  if (a.status === 'scheduled') return 'Nueva fecha propuesta';
  if (a.status === 'confirmed') return 'Confirmada';
  if (a.status === 'rejected') return 'Rechazada';
  if (a.status === 'cancelled') return 'Cancelada';
  if (a.status === 'completed') return 'Completada';
  return a.status;
}

function statusTone(a: ClientAppointment): StatusBadgeTone {
  if (a.status === 'confirmed') return 'success';
  if (a.status === 'scheduled' && a.proposed_by === 'business') return 'pending';
  if (a.status === 'rejected' || a.status === 'cancelled') return 'danger';
  return 'neutral';
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
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
    requestsSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
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
    circleActionsRow: {
      flexDirection: 'row',
      marginTop: 14,
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
}
