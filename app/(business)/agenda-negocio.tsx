import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { CircleActionButton } from '../../components/CircleActionButton';
import { StatusBadge, type StatusBadgeTone } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { InfoButton, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import {
  approveAppointment,
  cancelAppointment,
  completeAppointment,
  getBusinessAppointments,
  proposeDate,
  rescheduleDirect,
  rejectAppointment,
  subscribeToBusinessAppointments,
  type BusinessAppointment,
} from '../../services/appointments';
import { getMyWorkBusiness } from '../../services/businesses';
import { syncAppointmentReminders } from '../../services/appointmentReminders';
import { formatVehicle, type BusinessType } from '../../types/database';
import { createClientReview, getReviewedTargetIds } from '../../services/reviews';
import { getReportIdsByAppointments, type AppointmentReportInfo } from '../../services/serviceReports';

function defaultTime(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

interface AgendaData {
  businessId: string | null;
  businessType: BusinessType | null;
  appointments: BusinessAppointment[];
  reviewedAppointmentIds: Set<string>;
  reportIdsByAppointment: Map<string, AppointmentReportInfo>;
}

export default function AgendaNegocioScreen() {
  const { profile } = useAuth();

  // Panel de proponer/contra-proponer fecha
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [pickerTime, setPickerTime] = useState(() => defaultTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
      reviewedAppointmentIds: new Set(),
      reportIdsByAppointment: new Map(),
    };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    if (work.business.business_type !== 'workshop') {
      return { ...empty, businessId: work.business.id, businessType: work.business.business_type };
    }
    const [result, { appointmentIds }, reportMap] = await Promise.all([
      getBusinessAppointments(work.business.id),
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
      reviewedAppointmentIds: appointmentIds,
      reportIdsByAppointment: reportMap,
    };
  });
  const businessId = data?.businessId ?? null;
  const businessType = data?.businessType ?? null;
  const appointments = data?.appointments ?? [];
  const reviewedAppointmentIds = data?.reviewedAppointmentIds ?? new Set<string>();
  const reportIdsByAppointment = data?.reportIdsByAppointment ?? new Map<string, AppointmentReportInfo>();

  function setAppointments(updater: (prev: BusinessAppointment[]) => BusinessAppointment[]) {
    setData((prev) => (prev ? { ...prev, appointments: updater(prev.appointments) } : prev));
  }

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

  function startProposing(id: string) {
    setProposingId(id);
    setPickerDate(new Date());
    setPickerTime(defaultTime());
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function cancelProposing() {
    setProposingId(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function handleDateChange(event: any, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  }

  function handleTimeChange(event: any, time?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) setPickerTime(time);
  }

  async function handleConfirmPropose(id: string, isExternal: boolean) {
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);

    if (dt.getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }

    setSaving(true);
    try {
      if (isExternal) {
        await rescheduleDirect(id, dt.toISOString());
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: 'confirmed', requested_at: dt.toISOString(), proposed_by: null }
              : a
          )
        );
      } else {
        await proposeDate(id, dt.toISOString(), 'business');
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: 'scheduled', requested_at: dt.toISOString(), proposed_by: 'business' }
              : a
          )
        );
      }
      setProposingId(null);
    } catch (err) {
      console.error('propose date error', err);
      Alert.alert('Error', 'No se pudo reagendar la cita.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAccept(id: string) {
    try {
      await approveAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a)));
    } catch (err) {
      console.error('approve appointment error', err);
      Alert.alert('Error', 'No se pudo aceptar la cita.');
    }
  }

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
              {appointment.status === 'pending' && proposingId !== appointment.id && (
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
                    onPress={() => startProposing(appointment.id)}
                  />
                </View>
              )}

              {/* Cliente propuso → aceptar o contra-proponer */}
              {clientProposed && proposingId !== appointment.id && (
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
                    onPress={() => startProposing(appointment.id)}
                  />
                  <CircleActionButton
                    icon="checkmark"
                    label="Aceptar"
                    color={colors.primary}
                    onPress={() => handleAccept(appointment.id)}
                  />
                </View>
              )}

              {/* Taller propuso → esperando que el cliente responda */}
              {businessProposed && proposingId !== appointment.id && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>Esperando respuesta del cliente.</Text>
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="calendar-outline"
                      label="Cambiar fecha"
                      color={colors.primary}
                      variant="outline"
                      onPress={() => startProposing(appointment.id)}
                    />
                  </View>
                </View>
              )}

              {/* Panel de proponer/contra-proponer fecha */}
              {proposingId === appointment.id && (
                <View style={styles.proposeBox}>
                  <Text style={styles.proposeTitle}>
                    {clientProposed ? 'Proponer otra fecha' : 'Proponer fecha'}
                  </Text>

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

                  <View style={styles.circleActionsRow}>
                    <CircleActionButton
                      icon="close"
                      label="Cancelar"
                      color={colors.textMuted}
                      variant="outline"
                      onPress={cancelProposing}
                    />
                    <CircleActionButton
                      icon="checkmark"
                      label="Confirmar fecha"
                      color={colors.primary}
                      loading={saving}
                      onPress={() => handleConfirmPropose(appointment.id, appointment.client_id === null)}
                    />
                  </View>
                </View>
              )}

              {/* Confirmada */}
              {appointment.status === 'confirmed' && proposingId !== appointment.id && (
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
                    onPress={() => startProposing(appointment.id)}
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
            Si el cliente pidió la cita sin sugerir fecha, la ves como "Sin fecha aún" -- te toca a ti proponer una
            con "Proponer fecha".
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

const styles = StyleSheet.create({
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
