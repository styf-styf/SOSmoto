import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { approveAppointment, proposeDate, rescheduleDirect } from '../services/appointments';
import type { AppointmentStatus } from '../types/database';

export interface AppointmentReschedulePatch {
  status?: AppointmentStatus;
  requested_at?: string;
  proposed_by?: 'client' | 'business' | null;
}

// La misma lógica de "proponer fecha / contra-proponer / aprobar" para una
// cita ya existente (distinto de aceptar una solicitud nueva, ver
// useBusinessAppointmentRequestActions) estaba reimplementada de forma
// independiente en agenda-negocio.tsx, citas.tsx y servicio/[id].tsx.
//
// No usa el patrón "setItems array" de los otros hooks porque
// servicio/[id].tsx maneja un solo objeto (activeAppointment), no una
// lista -- en su lugar recibe onUpdated(id, patch) y cada pantalla decide
// cómo aplicarlo (map sobre su lista, o reemplazar su único objeto).
//
// role importa para dos cosas reales, no solo cosméticas:
// - El valor por defecto de fecha/hora al abrir el formulario: el negocio
//   parte de "ahora mismo", el cliente de "mañana 9am" (mismo criterio que
//   ya tenía cada pantalla).
// - Solo el negocio puede pasar isExternal=true en confirmReschedule (un
//   cliente externo no tiene forma de "aprobar" nada en la app, así que ahí
//   se llama a rescheduleDirect -- fecha directa, sin negociación -- en vez
//   de proposeDate).
export function useAppointmentRescheduleActions(
  role: 'client' | 'business',
  onUpdated: (id: string, patch: AppointmentReschedulePatch) => void
) {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(() => initialPickerDate(role));
  const [pickerTime, setPickerTime] = useState<Date>(() => initialPickerTime(role));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  function startRescheduling(id: string) {
    setReschedulingId(id);
    setPickerDate(initialPickerDate(role));
    setPickerTime(initialPickerTime(role));
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function cancelRescheduling() {
    setReschedulingId(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }

  function handleDateChange(_event: unknown, date?: Date) {
    // En iOS el picker es "inline" (se queda abierto para seguir
    // desplazando) -- solo Android lo cierra solo al elegir.
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  }

  function handleTimeChange(_event: unknown, time?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) setPickerTime(time);
  }

  async function confirmReschedule(id: string, options?: { isExternal?: boolean }) {
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
    if (dt.getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }
    setSaving(true);
    try {
      if (role === 'business' && options?.isExternal) {
        await rescheduleDirect(id, dt.toISOString());
        onUpdated(id, { status: 'confirmed', requested_at: dt.toISOString(), proposed_by: null });
      } else {
        await proposeDate(id, dt.toISOString(), role);
        onUpdated(id, { status: 'scheduled', requested_at: dt.toISOString(), proposed_by: role });
      }
      setReschedulingId(null);
    } catch (err) {
      console.error('propose date error', err);
      Alert.alert('Error', 'No se pudo reagendar la cita.');
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    if (approvingId) return;
    setApprovingId(id);
    try {
      await approveAppointment(id);
      onUpdated(id, { status: 'confirmed' });
    } catch (err) {
      console.error('approve appointment error', err);
      Alert.alert('Error', 'No se pudo aprobar. Intenta de nuevo.');
    } finally {
      setApprovingId(null);
    }
  }

  return {
    reschedulingId,
    pickerDate,
    pickerTime,
    showDatePicker,
    showTimePicker,
    saving,
    approvingId,
    setShowDatePicker,
    setShowTimePicker,
    startRescheduling,
    cancelRescheduling,
    handleDateChange,
    handleTimeChange,
    confirmReschedule,
    approve,
  };
}

function initialPickerDate(role: 'client' | 'business'): Date {
  if (role === 'business') return new Date();
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function initialPickerTime(role: 'client' | 'business'): Date {
  if (role === 'business') {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
