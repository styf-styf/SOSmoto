import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { AppointmentCalendar } from '../../components/AppointmentCalendar';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
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
import { formatVehicle } from '../../types/database';
import { createClientReview, getReviewedTargetIds } from '../../services/reviews';
import { getReportIdsByAppointments } from '../../services/serviceReports';

function defaultTime(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AgendaNegocioScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<BusinessAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel de proponer/contra-proponer fecha
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [pickerTime, setPickerTime] = useState(() => defaultTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
  const [reportIdsByAppointment, setReportIdsByAppointment] = useState<Map<string, string>>(new Map());
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async (id: string) => {
    const result = await getBusinessAppointments(id);
    setAppointments(result);
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
  }, []);

  const loadReviewed = useCallback(async (bizId: string) => {
    if (!profile) return;
    const [{ appointmentIds }, reportMap] = await Promise.all([
      getReviewedTargetIds(profile.id),
      getReportIdsByAppointments(bizId),
    ]);
    setReviewedAppointmentIds(appointmentIds);
    setReportIdsByAppointment(reportMap);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getMyWorkBusiness(profile.id)
      .then((work) => {
        if (!work) return;
        setBusinessId(work.business.id);
        return Promise.all([load(work.business.id), loadReviewed(work.business.id)]);
      })
      .catch((err) => console.error('load agenda error', err))
      .finally(() => setLoading(false));
  }, [profile, load, loadReviewed]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessAppointments(businessId, () => {
      load(businessId).catch((err) => console.error('reload agenda error', err));
    });
    return unsubscribe;
  }, [businessId, load]);

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

  async function handleReject(id: string) {
    try {
      await rejectAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
    } catch (err) {
      console.error('reject appointment error', err);
    }
  }

  async function handleComplete(id: string) {
    try {
      await completeAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'completed' } : a)));
    } catch (err) {
      console.error('complete appointment error', err);
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelAppointment(id, 'business');
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
    } catch (err) {
      console.error('cancel appointment error', err);
    }
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

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBtns}>
        <Pressable style={[styles.newCitaBtn, { flex: 1 }]} onPress={() => router.push('/(business)/nueva-cita')}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.newCitaBtnText}>Nueva cita</Text>
        </Pressable>
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

          return (
            <View key={appointment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{appointment.display_name}</Text>
                  {!appointment.client_id && (
                    <Text style={styles.externalBadge}>Externo</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, statusBadgeStyle(appointment)]}>
                  <Text style={[styles.statusText, statusTextStyle(appointment)]}>
                    {statusLabel(appointment)}
                  </Text>
                </View>
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
                <View style={styles.actionsRow}>
                  <Button
                    title="Proponer fecha"
                    onPress={() => startProposing(appointment.id)}
                    style={styles.flexButton}
                  />
                  <Button
                    title="Rechazar"
                    variant="secondary"
                    onPress={() => handleReject(appointment.id)}
                    style={styles.flexButton}
                  />
                </View>
              )}

              {/* Cliente propuso → aceptar o contra-proponer */}
              {clientProposed && proposingId !== appointment.id && (
                <View style={styles.actionsRow}>
                  <Button
                    title="Aceptar"
                    onPress={() => handleAccept(appointment.id)}
                    style={styles.flexButton}
                  />
                  <Button
                    title="Proponer otra"
                    variant="secondary"
                    onPress={() => startProposing(appointment.id)}
                    style={styles.flexButton}
                  />
                  <Button
                    title="Rechazar"
                    variant="secondary"
                    onPress={() => handleReject(appointment.id)}
                    style={styles.rejectButton}
                  />
                </View>
              )}

              {/* Taller propuso → esperando que el cliente responda */}
              {businessProposed && proposingId !== appointment.id && (
                <View style={styles.waitingRow}>
                  <Text style={styles.waitingText}>Esperando respuesta del cliente.</Text>
                  <Button
                    title="Cambiar fecha"
                    variant="secondary"
                    onPress={() => startProposing(appointment.id)}
                    style={styles.changeButton}
                  />
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

                  <View style={styles.actionsRow}>
                    <Button
                      title="Confirmar fecha"
                      onPress={() => handleConfirmPropose(appointment.id, appointment.client_id === null)}
                      loading={saving}
                      style={styles.flexButton}
                    />
                    <Button
                      title="Cancelar"
                      variant="secondary"
                      onPress={cancelProposing}
                      style={styles.flexButton}
                    />
                  </View>
                </View>
              )}

              {/* Confirmada */}
              {appointment.status === 'confirmed' && proposingId !== appointment.id && (
                <>
                  <View style={styles.actionsRow}>
                    <Button
                      title="Completar"
                      onPress={() => handleComplete(appointment.id)}
                      style={styles.flexButton}
                    />
                    <Button
                      title="Reagendar"
                      variant="secondary"
                      onPress={() => startProposing(appointment.id)}
                      style={styles.flexButton}
                    />
                  </View>
                  <Button
                    title="Cancelar cita"
                    variant="secondary"
                    onPress={() => handleCancel(appointment.id)}
                    style={styles.changeButton}
                  />
                </>
              )}

              {/* Informe de servicio */}
              {appointment.status !== 'cancelled' && appointment.status !== 'rejected' && (
                appointment.status === 'completed' ? (
                  reportIdsByAppointment.has(appointment.id) ? (
                    <Button
                      title="Ver informe"
                      variant="secondary"
                      onPress={() => router.push(`/(business)/informe/${reportIdsByAppointment.get(appointment.id)}`)}
                      style={styles.changeButton}
                    />
                  ) : (
                    <Button
                      title="Crear informe"
                      variant="secondary"
                      onPress={() => router.push(buildInformeUrl(appointment))}
                      style={styles.changeButton}
                    />
                  )
                ) : (
                  <Button
                    title="Informe"
                    variant="secondary"
                    onPress={() => router.push(buildInformeUrl(appointment))}
                    style={styles.changeButton}
                  />
                )
              )}

              {/* Calificar cliente tras completar (solo si tiene cuenta en la app) */}
              {appointment.status === 'completed' && appointment.client_id && ratingId !== appointment.id && (
                reviewedAppointmentIds.has(appointment.id) ? (
                  <Text style={styles.reviewedText}>Ya calificaste a este cliente.</Text>
                ) : (
                  <Button
                    title="Calificar cliente"
                    variant="secondary"
                    onPress={() => startRating(appointment.id)}
                    style={styles.changeButton}
                  />
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
                  <View style={styles.actionsRow}>
                    <Button
                      title="Enviar"
                      onPress={() => handleSubmitRating(appointment)}
                      loading={savingReview}
                      style={styles.flexButton}
                    />
                    <Button
                      title="Cancelar"
                      variant="secondary"
                      onPress={cancelRating}
                      style={styles.flexButton}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        }))
      }
      </ScrollView>
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

function statusBadgeStyle(a: BusinessAppointment) {
  if (a.status === 'confirmed') return { backgroundColor: '#E7F6EC' };
  if (a.status === 'scheduled' && a.proposed_by === 'client') return { backgroundColor: '#FFF1E6' };
  if (a.status === 'rejected' || a.status === 'cancelled') return { backgroundColor: '#FBE8E8' };
  return { backgroundColor: colors.surface };
}

function statusTextStyle(a: BusinessAppointment) {
  if (a.status === 'confirmed') return { color: colors.success };
  if (a.status === 'scheduled' && a.proposed_by === 'client') return { color: colors.primary };
  if (a.status === 'rejected' || a.status === 'cancelled') return { color: colors.danger };
  return { color: colors.textMuted };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
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
  changeButton: {
    marginTop: 8,
  },
  rejectButton: {
    flex: 1,
    borderColor: colors.danger,
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
