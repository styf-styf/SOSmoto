import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { CircleActionButton } from '../../components/CircleActionButton';
import { StatusBadge, type StatusBadgeTone } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { InfoButton, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import {
  cancelAppointment,
  completeAppointment,
  getBusinessAppointments,
  rejectAppointment,
  subscribeToBusinessAppointments,
  type BusinessAppointment,
} from '../../services/appointments';
import {
  getBusinessAppointmentRequests,
  subscribeToBusinessAppointmentRequests,
  type BusinessAppointmentRequest,
} from '../../services/appointmentRequests';
import { useBusinessAppointmentRequestActions } from '../../hooks/useBusinessAppointmentRequestActions';
import { useAppointmentRescheduleActions } from '../../hooks/useAppointmentRescheduleActions';
import { getMyWorkBusiness } from '../../services/businesses';
import { syncAppointmentReminders } from '../../services/appointmentReminders';
import { formatVehicle, type BusinessType } from '../../types/database';
import { createClientReview, getReviewedTargetIds } from '../../services/reviews';
import { getReportIdsByAppointments, type AppointmentReportInfo } from '../../services/serviceReports';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

interface AgendaData {
  businessId: string | null;
  businessType: BusinessType | null;
  appointments: BusinessAppointment[];
  requests: BusinessAppointmentRequest[];
  reviewedAppointmentIds: Set<string>;
  reportIdsByAppointment: Map<string, AppointmentReportInfo>;
}

export default function AgendaNegocioScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const cacheKey = profile ? `agenda-negocio-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<AgendaData>(cacheKey, async () => {
    const empty: AgendaData = {
      businessId: null,
      businessType: null,
      appointments: [],
      requests: [],
      reviewedAppointmentIds: new Set(),
      reportIdsByAppointment: new Map(),
    };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    if (work.business.business_type !== 'workshop') {
      return { ...empty, businessId: work.business.id, businessType: work.business.business_type };
    }
    const [result, requests, { appointmentIds }, reportMap] = await Promise.all([
      getBusinessAppointments(work.business.id),
      getBusinessAppointmentRequests(work.business.id),
      getReviewedTargetIds(profile.id),
      getReportIdsByAppointments(work.business.id),
    ]);
    // Sincronizar recordatorios locales para el taller
    syncAppointmentReminders(
      result.map((a) => ({
        id: a.id,
        requested_at: a.requested_at,
        status: a.status,
        label: a.display_name,
        serviceName: a.service_name,
      }))
    ).catch((err) => console.warn('sync reminders error', err));
    return {
      businessId: work.business.id,
      businessType: work.business.business_type,
      appointments: result,
      requests,
      reviewedAppointmentIds: appointmentIds,
      reportIdsByAppointment: reportMap,
    };
  });
  const businessId = data?.businessId ?? null;
  const businessType = data?.businessType ?? null;
  const appointments = data?.appointments ?? [];
  const requests = data?.requests ?? [];
  const reviewedAppointmentIds = data?.reviewedAppointmentIds ?? new Set<string>();
  const reportIdsByAppointment = data?.reportIdsByAppointment ?? new Map<string, AppointmentReportInfo>();

  function setAppointments(updater: (prev: BusinessAppointment[]) => BusinessAppointment[]) {
    setData((prev) => (prev ? { ...prev, appointments: updater(prev.appointments) } : prev));
  }

  const rescheduleActions = useAppointmentRescheduleActions('business', (id, patch) =>
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  );

  function setRequests(updater: (prev: BusinessAppointmentRequest[]) => BusinessAppointmentRequest[]) {
    setData((prev) => (prev ? { ...prev, requests: updater(prev.requests) } : prev));
  }

  const requestActions = useBusinessAppointmentRequestActions<BusinessAppointmentRequest>(setRequests);

  function setReviewedAppointmentIds(updater: (prev: Set<string>) => Set<string>) {
    setData((prev) => (prev ? { ...prev, reviewedAppointmentIds: updater(prev.reviewedAppointmentIds) } : prev));
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load agenda error', err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!businessId) return;
    // Un cambio real notificado por el servidor SÍ amerita recargar (no es
    // un "por si acaso" al revisitar la pantalla, es un cambio confirmado).
    const unsubscribe = subscribeToBusinessAppointments(businessId, () => {
      reload().catch((err) => console.error('reload agenda error', err));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Solicitudes (appointment_requests, todavía sin fila en appointments) --
  // suscripción aparte porque viven en una tabla distinta.
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessAppointmentRequests(businessId, () => {
      reload().catch((err) => console.error('reload agenda error', err));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Recarga el mapa de informes cada vez que la pantalla recupera el foco
  // (ej. al volver de nuevo-informe tras guardar borrador) -- este sí es un
  // caso de "algo cambió en otra pantalla", no un refresco "por si acaso".
  useFocusEffect(
    useCallback(() => {
      if (!businessId) return;
      getReportIdsByAppointments(businessId)
        .then((map) => setData((prev) => (prev ? { ...prev, reportIdsByAppointment: map } : prev)))
        .catch((err) => console.error('reload reports on focus', err));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId])
  );

  function handleReject(id: string) {
    Alert.alert('Rechazar cita', '¿Seguro que quieres rechazar esta cita? El cliente será notificado.', [
      { text: 'No rechazar', style: 'cancel' },
      {
        text: 'Sí, rechazar',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectAppointment(id);
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
          } catch (err) {
            console.error('reject appointment error', err);
            Alert.alert('Error', 'No se pudo rechazar la cita.');
          }
        },
      },
    ]);
  }

  async function handleComplete(id: string) {
    try {
      await completeAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'completed' } : a)));
    } catch (err) {
      console.error('complete appointment error', err);
    }
  }

  function handleCancel(id: string) {
    Alert.alert('Cancelar cita', '¿Seguro que quieres cancelar esta cita? El cliente será notificado.', [
      { text: 'No cancelar', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAppointment(id, 'business');
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
          } catch (err) {
            console.error('cancel appointment error', err);
            Alert.alert('Error', 'No se pudo cancelar la cita.');
          }
        },
      },
    ]);
  }

  function startRating(id: string) {
    setRatingId(id);
    setRating(5);
    setComment('');
  }

  function cancelRating() {
    setRatingId(null);
  }

  async function handleSubmitRating(appointment: BusinessAppointment) {
    if (!profile || !appointment.client_id) return;
    setSavingReview(true);
    try {
      await createClientReview({
        reviewerId: profile.id,
        clientId: appointment.client_id,
        appointmentId: appointment.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setReviewedAppointmentIds((prev) => new Set(prev).add(appointment.id));
      setRatingId(null);
    } catch (err) {
      console.error('create client review error', err);
      Alert.alert('Error', 'No se pudo enviar la calificación.');
    } finally {
      setSavingReview(false);
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

  if (!businessId) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea o únete a un negocio.</Text>
      </View>
    );
  }

  // La agenda/citas es exclusiva de taller -- el menú de Configuración ya
  // oculta esta entrada para tienda, pero se guarda sola por si llega por
  // otro camino (link viejo, deep link).
  if (businessType !== 'workshop') {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>La agenda de citas es exclusiva de talleres.</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <View style={styles.topBtns}>
        <Pressable style={[styles.newCitaBtn, { flex: 1 }]} onPress={() => router.push('/(business)/nueva-cita')}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.newCitaBtnText}>Nueva cita</Text>
        </Pressable>
        <InfoButton onPress={() => setShowInfo(true)} accessibilityLabel="Cómo funciona el flujo de citas" />
      </View>

      {requests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>Solicitudes de cita</Text>
          {requests.map((request) => (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.avatar}>
                    {request.client_avatar_url ? (
                      <Image source={{ uri: request.client_avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={16} color={colors.textMuted} />
                    )}
                  </View>
                  <Text style={styles.cardTitle}>{request.client_name}</Text>
                </View>
                <StatusBadge label="Sin responder" tone="pending" />
              </View>
              {request.service_name && <Text style={styles.cardMeta}>{request.service_name}</Text>}
              {request.vehicle_label && <Text style={styles.cardMeta}>{request.vehicle_label}</Text>}
              {request.notes && <Text style={styles.cardMeta}>{request.notes}</Text>}
              {request.suggested_at && (
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>El cliente sugiere:</Text>
                  <Text style={styles.dateValue}>{fmtDate(request.suggested_at)}</Text>
                </View>
              )}

              {requestActions.approvingRequestId === request.id ? (
                <View style={styles.proposeBox}>
                  <Text style={styles.proposeTitle}>Confirmar fecha de cita</Text>

                  <Text style={styles.fieldLabel}>Fecha</Text>
                  <Pressable style={styles.pickerButton} onPress={() => requestActions.setShowApproveDatePicker((prev) => !prev)}>
                    <Text style={styles.pickerButtonText}>
                      {requestActions.approvePickerDate.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </Text>
                  </Pressable>
                  {requestActions.showApproveDatePicker && (
                    <DateTimePicker
                      value={requestActions.approvePickerDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                      minimumDate={new Date()}
                      onChange={requestActions.handleApproveDateChange}
                    />
                  )}

                  <Text style={styles.fieldLabel}>Hora</Text>
                  <Pressable style={styles.pickerButton} onPress={() => requestActions.setShowApproveTimePicker((prev) => !prev)}>
                    <Text style={styles.pickerButtonText}>
                      {requestActions.approvePickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {requestActions.showApproveTimePicker && (
                    <DateTimePicker value={requestActions.approvePickerTime} mode="time" display="spinner" onChange={requestActions.handleApproveTimeChange} />
                  )}

                  <View style={styles.circleActionsRow}>
                    <CircleActionButton icon="close" label="Cancelar" color={colors.textMuted} variant="outline" onPress={requestActions.cancelApproveForm} />
                    <CircleActionButton
                      icon="checkmark"
                      label="Confirmar cita"
                      color={colors.primary}
                      loading={requestActions.processingRequestId === request.id}
                      onPress={() => requestActions.handleAcceptRequest(request, request.client_name)}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Rechazar"
                    color={colors.danger}
                    onPress={() => requestActions.handleRejectRequest(request)}
                    disabled={requestActions.processingRequestId !== null}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer fecha"
                    color={colors.primary}
                    onPress={() => requestActions.openApproveForm(request)}
                    disabled={requestActions.processingRequestId !== null}
                  />
                </View>
              )}
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
          {selectedDate ? 'Sin citas para este día.' : 'Todavía no tienes citas agendadas.'}
        </Text>
      ) : (
        visibleAppointments.map((appointment) => {
          const clientProposed =
            appointment.status === 'scheduled' && appointment.proposed_by === 'client';
          const businessProposed =
            appointment.status === 'scheduled' && appointment.proposed_by === 'business';
          const rpt = reportIdsByAppointment.get(appointment.id);

          const hasFinishedReport = appointment.status === 'completed' && !!rpt && !rpt.isDraft;

          return (
            <Pressable
              key={appointment.id}
              style={styles.card}
              onPress={hasFinishedReport ? () => router.push(`/(business)/informe/${rpt!.id}`) : undefined}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.avatar}>
                    {appointment.client?.avatar_url ? (
                      <Image source={{ uri: appointment.client.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={16} color={colors.textMuted} />
                    )}
                  </View>
                  <Text style={styles.cardTitle}>{appointment.display_name}</Text>
                  {!appointment.client_id && (
                    <Text style={styles.externalBadge}>Externo</Text>
                  )}
                </View>
                <StatusBadge label={statusLabel(appointment)} tone={statusTone(appointment)} />
              </View>

              {(appointment.client?.phone ?? appointment.external_client_phone) && (
                <Text style={styles.cardMeta}>
                  {appointment.client?.phone ?? appointment.external_client_phone}
                </Text>
              )}
              {appointment.vehicle && (
                <Text style={styles.cardMeta}>{formatVehicle(appointment.vehicle)}</Text>
              )}
              {appointment.service_name && (
                <Text style={styles.cardMeta}>{appointment.service_name}</Text>
              )}
              {appointment.notes && <Text style={styles.cardMeta}>{appointment.notes}</Text>}

              {/* Fecha propuesta */}
              {appointment.requested_at && (
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>
                    {clientProposed ? 'El cliente propone:' : 'Tu propuesta:'}
                  </Text>
                  <Text style={styles.dateValue}>{fmtDate(appointment.requested_at)}</Text>
                </View>
              )}

              {/* Sin fecha aún → proponer o rechazar */}
              {appointment.status === 'pending' && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Rechazar"
                    color={colors.danger}
                    onPress={() => handleReject(appointment.id)}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer fecha"
                    color={colors.primary}
                    onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                  />
                </View>
              )}

              {/* Cliente propuso → aceptar o contra-proponer */}
              {clientProposed && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Rechazar"
                    color={colors.danger}
                    onPress={() => handleReject(appointment.id)}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer otra"
                    color={colors.primary}
                    variant="outline"
                    onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                  />
                  <CircleActionButton
                    icon="checkmark"
                    label="Aceptar"
                    color={colors.primary}
                    loading={rescheduleActions.approvingId === appointment.id}
                    onPress={() => rescheduleActions.approve(appointment.id)}
                  />
                </View>
              )}

              {/* Taller propuso → esperando que el cliente responda */}
              {businessProposed && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>Esperando respuesta del cliente.</Text>
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="calendar-outline"
                      label="Cambiar fecha"
                      color={colors.primary}
                      variant="outline"
                      onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                    />
                  </View>
                </View>
              )}

              {/* Panel de proponer/contra-proponer fecha */}
              {rescheduleActions.reschedulingId === appointment.id && (
                <View style={styles.proposeBox}>
                  <Text style={styles.proposeTitle}>
                    {clientProposed ? 'Proponer otra fecha' : 'Proponer fecha'}
                  </Text>

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
                      label="Confirmar fecha"
                      color={colors.primary}
                      loading={rescheduleActions.saving}
                      onPress={() => rescheduleActions.confirmReschedule(appointment.id, { isExternal: appointment.client_id === null })}
                    />
                  </View>
                </View>
              )}

              {/* Confirmada */}
              {appointment.status === 'confirmed' && rescheduleActions.reschedulingId !== appointment.id && (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Cancelar cita"
                    color={colors.danger}
                    onPress={() => handleCancel(appointment.id)}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Reagendar"
                    color={colors.primary}
                    variant="outline"
                    onPress={() => rescheduleActions.startRescheduling(appointment.id)}
                  />
                  <CircleActionButton
                    icon="checkmark"
                    label="Completar"
                    color={colors.primary}
                    onPress={() => handleComplete(appointment.id)}
                  />
                </View>
              )}

              {/* Informe de servicio -- mismo patrón que las tarjetas de
                  cliente/[id].tsx: ícono de hoja + texto de link (no un
                  botón), con el texto siempre específico (nunca el genérico
                  "Informe"). */}
              {appointment.status !== 'cancelled' && appointment.status !== 'rejected' && (
                <Pressable
                  style={styles.informeLinkRow}
                  onPress={() =>
                    rpt && !rpt.isDraft
                      ? router.push(`/(business)/informe/${rpt.id}`)
                      : router.push(buildInformeUrl(appointment))
                  }
                >
                  <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                  <Text style={styles.informeLinkText}>
                    {rpt && !rpt.isDraft ? 'Ver informe' : rpt?.isDraft ? 'Continuar borrador' : 'Crear informe'}
                  </Text>
                </Pressable>
              )}

              {/* Calificar cliente tras completar (solo si tiene cuenta en la app) */}
              {appointment.status === 'completed' && appointment.client_id && ratingId !== appointment.id && (
                reviewedAppointmentIds.has(appointment.id) ? (
                  <Text style={styles.reviewedText}>Ya calificaste a este cliente.</Text>
                ) : (
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="star-outline"
                      label="Calificar cliente"
                      color={colors.primary}
                      variant="outline"
                      onPress={() => startRating(appointment.id)}
                    />
                  </View>
                )
              )}

              {ratingId === appointment.id && (
                <View style={styles.proposeBox}>
                  <Text style={styles.activeMeta}>
                    Calificación interna — no es pública. Ayuda a detectar clientes que cancelan sin razón.
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable key={value} onPress={() => setRating(value)}>
                        <Ionicons
                          name={value <= rating ? 'star' : 'star-outline'}
                          size={24}
                          color={colors.warning}
                        />
                      </Pressable>
                    ))}
                  </View>
                  <TextField label="Comentario interno (opcional)" value={comment} onChangeText={setComment} />
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="close"
                      label="Cancelar"
                      color={colors.textMuted}
                      variant="outline"
                      onPress={cancelRating}
                    />
                    <CircleActionButton
                      icon="send"
                      label="Enviar"
                      color={colors.primary}
                      loading={savingReview}
                      onPress={() => handleSubmitRating(appointment)}
                    />
                  </View>
                </View>
              )}
            </Pressable>
          );
        }))
      }
      </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal visible={showInfo} title="Cómo funciona el flujo de citas" onClose={() => setShowInfo(false)}>
        <InfoStep number={1} title="Cómo llega una cita nueva">
          <Text style={infoTextStyles.text}>
            Cuando un cliente pide una cita por primera vez, aparece en "Solicitudes de cita" arriba del calendario
            (antes solo se veía en el chat) -- puedes rechazarla o confirmarle una fecha ahí mismo, sin entrar al
            chat. Ya aceptada, si no le pusiste fecha todavía la ves como "Sin fecha aún" en la lista de abajo -- te
            toca a ti proponer una con "Proponer fecha".
          </Text>
        </InfoStep>

        <InfoStep number={2} title="A veces el cliente ya propuso fecha">
          <Text style={infoTextStyles.text}>
            Si el cliente sugirió fecha y hora al pedir la cita, la ves como "Cliente propuso fecha" -- puedes
            "Aceptar", "Proponer otra" (tu contrapropuesta) o "Rechazar".
          </Text>
        </InfoStep>

        <InfoStep number={3} title="Cuando tú propones, esperas respuesta">
          <Text style={infoTextStyles.text}>
            Verás "Esperando respuesta del cliente" hasta que él la acepte o pida otro cambio -- puedes tocar "Cambiar
            fecha" si te arrepientes antes de que responda.
          </Text>
        </InfoStep>

        <InfoStep number={4} title="El ida y vuelta de propuestas">
          <Text style={infoTextStyles.text}>
            No hay límite de rondas -- pueden proponer y contraproponer las veces que hagan falta hasta que alguno
            toque "Aceptar"/"Aprobar".
          </Text>
        </InfoStep>

        <InfoStep number={5} title="Confirmada = ambos de acuerdo">
          <Text style={infoTextStyles.text}>
            Desde ahí puedes "Completar" (cuando termines el servicio), "Reagendar" si algo cambia, o "Cancelar cita".
          </Text>
        </InfoStep>

        <InfoStep number={6} title="Informe de servicio y calificación">
          <Text style={infoTextStyles.text}>
            Después de completar, puedes crear un informe de lo que hiciste (queda disponible para el cliente) y
            calificar al cliente -- esa calificación es interna, no pública, y ayuda a detectar clientes que cancelan
            seguido o no se presentan.
          </Text>
        </InfoStep>

        <InfoStep number={7} title="Si el cliente no usa la app">
          <Text style={infoTextStyles.text}>
            Puedes agendarle una cita igual: en "Clientes" agrégalo primero como cliente externo (nombre y teléfono),
            y en "Nueva cita" búscalo y elígelo -- aparece con la etiqueta "Externo". Esa cita se crea directo como
            "Confirmada" (no hay nadie del otro lado que pueda aceptar/rechazar en la app) y no se envía ninguna
            notificación -- avisarle la fecha queda por tu cuenta (llamada, WhatsApp, en persona). Solo tú recibes un
            recordatorio local 30 minutos antes.
          </Text>
        </InfoStep>
      </InfoModal>
    </>
  );
}

function buildInformeUrl(a: BusinessAppointment): string {
  return (
    `/(business)/nuevo-informe?appointmentId=${a.id}` +
    `&appointmentStatus=${a.status}` +
    (a.client_id ? `&clientId=${a.client_id}` : '') +
    (a.display_name ? `&clientName=${encodeURIComponent(a.display_name)}` : '') +
    (a.vehicle ? `&vehicleLabel=${encodeURIComponent(`${a.vehicle.brand} ${a.vehicle.model} ${a.vehicle.year}`)}` : '') +
    (a.vehicle?.plate ? `&vehiclePlate=${encodeURIComponent(a.vehicle.plate)}` : '') +
    (a.requested_at ? `&entryDate=${encodeURIComponent(a.requested_at)}` : '')
  );
}

function statusLabel(a: BusinessAppointment): string {
  if (a.status === 'pending') return 'Sin fecha aún';
  if (a.status === 'scheduled' && a.proposed_by === 'client') return 'Cliente propuso fecha';
  if (a.status === 'scheduled' && a.proposed_by === 'business') return 'Propuesta enviada';
  // Mismo fallback que citas.tsx (cliente): datos viejos pueden tener
  // proposed_by null junto con 'scheduled', mostrando el valor crudo del
  // enum en vez de un texto traducido.
  if (a.status === 'scheduled') return 'Nueva fecha propuesta';
  if (a.status === 'confirmed') return 'Confirmada';
  if (a.status === 'rejected') return 'Rechazada';
  if (a.status === 'cancelled') return 'Cancelada';
  if (a.status === 'completed') return 'Completada';
  return a.status;
}

function statusTone(a: BusinessAppointment): StatusBadgeTone {
  if (a.status === 'confirmed') return 'success';
  if (a.status === 'scheduled' && a.proposed_by === 'client') return 'pending';
  if (a.status === 'rejected' || a.status === 'cancelled') return 'danger';
  return 'neutral';
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
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
      paddingTop: 16,
      paddingBottom: 20,
      backgroundColor: colors.background,
    },
    placeholder: {
      color: colors.textMuted,
      fontSize: 14,
    },
    requestsSection: { marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
    topBtns: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    newCitaBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 12,
    },
    newCitaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cardTitleRow: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
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
    externalBadge: {
      fontSize: 10, fontWeight: '700', color: colors.textMuted,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
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
    informeLinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
    },
    informeLinkText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    proposeBox: {
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    proposeTitle: {
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
    reviewedText: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 12,
    },
    activeMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },
  });
}
