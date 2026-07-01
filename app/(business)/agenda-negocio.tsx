import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelAppointment,
  completeAppointment,
  getBusinessAppointments,
  rejectAppointment,
  scheduleAppointment,
  subscribeToBusinessAppointments,
  type BusinessAppointment,
} from '../../services/appointments';
import { getMyWorkBusiness } from '../../services/businesses';
import { createClientReview, getReviewedTargetIds } from '../../services/reviews';

const statusLabel: Record<BusinessAppointment['status'], string> = {
  pending: 'Pendiente de agendar',
  scheduled: 'Agendada, esperando aprobación',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

function defaultTime(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function AgendaNegocioScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<BusinessAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [pickerTime, setPickerTime] = useState(() => defaultTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async (id: string) => {
    const result = await getBusinessAppointments(id);
    setAppointments(result);
  }, []);

  const loadReviewed = useCallback(async () => {
    if (!profile) return;
    const { appointmentIds } = await getReviewedTargetIds(profile.id);
    setReviewedAppointmentIds(appointmentIds);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getMyWorkBusiness(profile.id)
      .then((work) => {
        if (!work) return;
        setBusinessId(work.business.id);
        return Promise.all([load(work.business.id), loadReviewed()]);
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

  function startScheduling(id: string) {
    setSchedulingId(id);
    setPickerDate(new Date());
    setPickerTime(defaultTime());
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function cancelScheduling() {
    setSchedulingId(null);
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

  async function handleConfirmSchedule(id: string) {
    const requestedAt = new Date(pickerDate);
    requestedAt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);

    if (requestedAt.getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }

    setSaving(true);
    try {
      await scheduleAppointment(id, requestedAt.toISOString());
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'scheduled', requested_at: requestedAt.toISOString() } : a))
      );
      setSchedulingId(null);
    } catch (err) {
      console.error('schedule appointment error', err);
      Alert.alert('Error', 'No se pudo agendar la cita.');
    } finally {
      setSaving(false);
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
    if (!profile) return;
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
    <ScrollView contentContainerStyle={styles.container}>
      {appointments.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no tienes citas agendadas.</Text>
      ) : (
        appointments.map((appointment) => (
          <View key={appointment.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{appointment.client?.full_name ?? 'Cliente'}</Text>
              <Text style={styles.statusBadge}>{statusLabel[appointment.status]}</Text>
            </View>
            {appointment.client?.phone && <Text style={styles.cardMeta}>{appointment.client.phone}</Text>}
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

            {appointment.status === 'pending' && schedulingId !== appointment.id && (
              <View style={styles.actionsRow}>
                <Button
                  title="Agendar"
                  onPress={() => startScheduling(appointment.id)}
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

            {schedulingId === appointment.id && (
              <View style={styles.scheduleBox}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker((prev) => !prev)}>
                  <Text style={styles.pickerButtonText}>
                    {pickerDate.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
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
                <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker((prev) => !prev)}>
                  <Text style={styles.pickerButtonText}>
                    {pickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Pressable>
                {showTimePicker && (
                  <DateTimePicker value={pickerTime} mode="time" display="spinner" onChange={handleTimeChange} />
                )}

                <View style={styles.actionsRow}>
                  <Button
                    title="Confirmar fecha"
                    onPress={() => handleConfirmSchedule(appointment.id)}
                    loading={saving}
                    style={styles.flexButton}
                  />
                  <Button title="Cancelar" variant="secondary" onPress={cancelScheduling} style={styles.flexButton} />
                </View>
              </View>
            )}

            {appointment.status === 'scheduled' && schedulingId !== appointment.id && (
              <View style={styles.actionsRow}>
                <Button
                  title="Cambiar fecha"
                  variant="secondary"
                  onPress={() => startScheduling(appointment.id)}
                  style={styles.flexButton}
                />
              </View>
            )}

            {appointment.status === 'confirmed' && schedulingId !== appointment.id && (
              <>
                <View style={styles.actionsRow}>
                  <Button title="Completar" onPress={() => handleComplete(appointment.id)} style={styles.flexButton} />
                  <Button
                    title="Reagendar"
                    variant="secondary"
                    onPress={() => startScheduling(appointment.id)}
                    style={styles.flexButton}
                  />
                </View>
                <Button
                  title="Cancelar cita"
                  variant="secondary"
                  onPress={() => handleCancel(appointment.id)}
                  style={styles.completeButton}
                />
              </>
            )}

            {appointment.status === 'completed' &&
              ratingId !== appointment.id &&
              (reviewedAppointmentIds.has(appointment.id) ? (
                <Text style={styles.reviewedText}>Ya calificaste a este cliente.</Text>
              ) : (
                <Button
                  title="Calificar cliente"
                  variant="secondary"
                  onPress={() => startRating(appointment.id)}
                  style={styles.completeButton}
                />
              ))}

            {ratingId === appointment.id && (
              <View style={styles.scheduleBox}>
                <Text style={styles.activeMeta}>
                  Calificación interna, no es pública. Ayuda a detectar clientes que cancelan o no se presentan.
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable key={value} onPress={() => setRating(value)}>
                      <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={24} color={colors.warning} />
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
                  <Button title="Cancelar" variant="secondary" onPress={cancelRating} style={styles.flexButton} />
                </View>
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
    padding: 20,
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
    color: colors.primary,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
  completeButton: {
    marginTop: 12,
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
  scheduleBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
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
});
