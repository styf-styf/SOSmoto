import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import {
  acceptAppointmentRequest,
  rejectAppointmentRequest,
  type AppointmentRequest,
} from '../services/appointmentRequests';
import { scheduleAppointmentReminder } from '../services/appointmentReminders';

function defaultApproveDate(suggestedAt?: string | null): Date {
  if (suggestedAt) {
    const suggested = new Date(suggestedAt);
    // Solo prellena con lo que sugirió el cliente si todavía es una fecha
    // futura -- si ya pasó (tardaste en responder), caer ahí dispararía de
    // inmediato la validación de "fecha en el pasado" al confirmar.
    if (!isNaN(suggested.getTime()) && suggested.getTime() > Date.now()) return suggested;
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// La misma lógica de "aceptar con fecha / rechazar" una solicitud de cita
// (lado negocio) estaba reimplementada de forma independiente en
// agenda-negocio.tsx y en el chat del negocio -- mismo patrón que
// useProductIntentAction, aplicado acá. Genérico sobre T para servir tanto
// a AppointmentRequest (chat) como a BusinessAppointmentRequest (agenda,
// trae client_name extra).
export function useBusinessAppointmentRequestActions<T extends AppointmentRequest>(
  setItems: (updater: (prev: T[]) => T[]) => void
) {
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [approvePickerDate, setApprovePickerDate] = useState<Date>(new Date());
  const [approvePickerTime, setApprovePickerTime] = useState<Date>(new Date());
  const [showApproveDatePicker, setShowApproveDatePicker] = useState(false);
  const [showApproveTimePicker, setShowApproveTimePicker] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  function openApproveForm(request: T) {
    const prefill = defaultApproveDate(request.suggested_at);
    setApprovePickerDate(prefill);
    setApprovePickerTime(prefill);
    setShowApproveDatePicker(false);
    setShowApproveTimePicker(false);
    setApprovingRequestId(request.id);
  }

  function cancelApproveForm() {
    setApprovingRequestId(null);
    setShowApproveDatePicker(false);
    setShowApproveTimePicker(false);
  }

  function handleApproveDateChange(_event: unknown, date?: Date) {
    if (Platform.OS === 'android') setShowApproveDatePicker(false);
    if (date) setApprovePickerDate(date);
  }

  function handleApproveTimeChange(_event: unknown, time?: Date) {
    if (Platform.OS === 'android') setShowApproveTimePicker(false);
    if (time) setApprovePickerTime(time);
  }

  async function handleAcceptRequest(request: T, clientLabel: string) {
    if (processingRequestId) return;
    const dt = new Date(approvePickerDate);
    dt.setHours(approvePickerTime.getHours(), approvePickerTime.getMinutes(), 0, 0);
    if (dt.getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }
    setProcessingRequestId(request.id);
    try {
      const appointment = await acceptAppointmentRequest(request, dt.toISOString());
      await scheduleAppointmentReminder({
        appointmentId: appointment.id,
        scheduledAt: dt.toISOString(),
        clientLabel,
        serviceName: request.service_name ?? undefined,
      });
      setItems((prev) => prev.filter((r) => r.id !== request.id));
      setApprovingRequestId((prev) => (prev === request.id ? null : prev));
    } catch (err) {
      console.error('accept appointment request error', err);
      Alert.alert('Error', 'No se pudo confirmar la cita. Intenta de nuevo.');
    } finally {
      setProcessingRequestId(null);
    }
  }

  function handleRejectRequest(request: T) {
    if (processingRequestId) return;
    Alert.alert('Rechazar solicitud', '¿Seguro que quieres rechazar esta solicitud de cita?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, rechazar',
        style: 'destructive',
        onPress: async () => {
          setProcessingRequestId(request.id);
          try {
            await rejectAppointmentRequest(request);
            setItems((prev) => prev.filter((r) => r.id !== request.id));
            setApprovingRequestId((prev) => (prev === request.id ? null : prev));
          } catch (err) {
            console.error('reject appointment request error', err);
            Alert.alert('Error', 'No se pudo rechazar la solicitud.');
          } finally {
            setProcessingRequestId(null);
          }
        },
      },
    ]);
  }

  // Para cuando la suscripción en tiempo real detecta que la solicitud dejó
  // de estar pendiente por otro lado (ej. el cliente la canceló mientras el
  // formulario de aprobar estaba abierto) -- cierra el formulario si era el
  // de esa misma solicitud.
  function resetIfApproving(requestId: string) {
    setApprovingRequestId((prev) => (prev === requestId ? null : prev));
  }

  return {
    approvingRequestId,
    approvePickerDate,
    approvePickerTime,
    showApproveDatePicker,
    showApproveTimePicker,
    processingRequestId,
    setShowApproveDatePicker,
    setShowApproveTimePicker,
    openApproveForm,
    cancelApproveForm,
    handleApproveDateChange,
    handleApproveTimeChange,
    handleAcceptRequest,
    handleRejectRequest,
    resetIfApproving,
  };
}
