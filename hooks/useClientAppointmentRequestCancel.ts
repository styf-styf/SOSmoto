import { useState } from 'react';
import { Alert } from 'react-native';
import { cancelAppointmentRequest, type AppointmentRequest } from '../services/appointmentRequests';

// Lado cliente de useBusinessAppointmentRequestActions -- la misma lógica
// de "cancelar solicitud" estaba reimplementada en citas.tsx y en el chat
// del cliente.
export function useClientAppointmentRequestCancel<T extends AppointmentRequest>(
  setItems: (updater: (prev: T[]) => T[]) => void
) {
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);

  function cancelRequest(request: T) {
    if (cancellingRequestId) return;
    Alert.alert('Cancelar solicitud', '¿Seguro que quieres cancelar la solicitud de cita?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingRequestId(request.id);
          try {
            await cancelAppointmentRequest(request);
            setItems((prev) => prev.filter((r) => r.id !== request.id));
          } catch (err) {
            console.error('cancel appointment request error', err);
            Alert.alert('Error', 'No se pudo cancelar la solicitud.');
          } finally {
            setCancellingRequestId(null);
          }
        },
      },
    ]);
  }

  return { cancellingRequestId, cancelRequest };
}
