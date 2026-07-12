import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { createAppointmentRequest } from '../../services/appointmentRequests';
import { getBusinessById } from '../../services/businesses';
import { getActiveServices } from '../../services/catalog';
import { getVehicles } from '../../services/vehicles';
import type { Business, Service, Vehicle } from '../../types/database';

function defaultSuggestTime(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

interface AgendarData {
  business: Business | null;
  services: Service[];
  vehicles: Vehicle[];
}

export default function AgendarScreen() {
  const { businessId, serviceId: initialServiceId } = useLocalSearchParams<{ businessId: string; serviceId?: string }>();
  const { profile } = useAuth();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId ?? null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Sugerencia de fecha (opcional)
  const [suggestDate, setSuggestDate] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => defaultSuggestTime());
  const [pickerTime, setPickerTime] = useState(() => defaultSuggestTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const cacheKey = businessId && profile ? `agendar-${businessId}-${profile.id}` : null;
  const { data, loading } = useCachedLoad<AgendarData>(cacheKey, async () => {
    if (!businessId || !profile) return { business: null, services: [], vehicles: [] };
    const [businessResult, serviceList, vehicleList] = await Promise.all([
      getBusinessById(businessId),
      getActiveServices(businessId),
      getVehicles(profile.id),
    ]);
    return { business: businessResult, services: serviceList, vehicles: vehicleList };
  });
  const business = data?.business ?? null;
  const services = data?.services ?? [];
  const vehicles = data?.vehicles ?? [];

  useEffect(() => {
    setSelectedVehicleId((prev) => prev ?? vehicles[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  function handleDateChange(event: any, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  }

  function handleTimeChange(event: any, time?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) setPickerTime(time);
  }

  function buildRequestedAt(): string | undefined {
    if (!suggestDate) return undefined;
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
    return dt.toISOString();
  }

  async function handleSubmit() {
    if (!profile || !businessId) return;

    const requestedAt = buildRequestedAt();
    if (requestedAt && new Date(requestedAt).getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const selectedService = services.find((s) => s.id === selectedServiceId);

    setSaving(true);
    try {
      await createAppointmentRequest({
        clientId: profile.id,
        businessId,
        vehicleId: selectedVehicleId ?? undefined,
        vehicleLabel: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : undefined,
        serviceId: selectedServiceId ?? undefined,
        serviceName: selectedService?.name,
        notes: notes.trim() || undefined,
        suggestedAt: requestedAt,
      });
      // Abrir el chat inmediatamente — el mensaje de la solicitud ya está ahí
      router.replace(`/(client)/chat/${businessId}`);
    } catch (err) {
      console.error('create appointment request error', err);
      Alert.alert('Error', 'No se pudo enviar la solicitud de cita.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const suggestedDateTime = (() => {
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
    return dt;
  })();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.placeholder}>{business?.name}</Text>
      <Text style={styles.hint}>
        Elige el servicio. Puedes sugerir una fecha o dejar que el taller te proponga una.
      </Text>

      {vehicles.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Tu moto (opcional)</Text>
          <View style={styles.chipRow}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                onPress={() => setSelectedVehicleId((prev) => (prev === vehicle.id ? null : vehicle.id))}
                style={[styles.chip, selectedVehicleId === vehicle.id && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selectedVehicleId === vehicle.id && styles.chipTextSelected]}>
                  {vehicle.brand} {vehicle.model}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.fieldLabel}>Servicio</Text>
      <View style={styles.chipRow}>
        {services.map((service) => (
          <Pressable
            key={service.id}
            onPress={() => setSelectedServiceId(service.id)}
            style={[styles.chip, selectedServiceId === service.id && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedServiceId === service.id && styles.chipTextSelected]}>
              {service.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setSelectedServiceId(null)}
          style={[styles.chip, selectedServiceId === null && styles.chipSelected]}
        >
          <Text style={[styles.chipText, selectedServiceId === null && styles.chipTextSelected]}>Otro</Text>
        </Pressable>
      </View>

      <TextField
        label="Notas (opcional)"
        placeholder="Cuéntale al taller qué necesitas"
        value={notes}
        onChangeText={setNotes}
        style={styles.notesInput}
      />

      {/* Sugerencia de fecha opcional */}
      <Pressable style={styles.toggleRow} onPress={() => setSuggestDate((prev) => !prev)}>
        <Ionicons
          name={suggestDate ? 'checkbox' : 'square-outline'}
          size={20}
          color={colors.primary}
        />
        <Text style={styles.toggleLabel}>Sugerir una fecha y hora (opcional)</Text>
      </Pressable>

      {suggestDate && (
        <View style={styles.dateBox}>
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

          <Text style={styles.dateHint}>
            Propuesta:{' '}
            {suggestedDateTime.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </View>
      )}

      <Button title="Enviar solicitud y abrir chat" onPress={handleSubmit} loading={saving} style={styles.submitButton} />
    </ScrollView>
  );
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
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  notesInput: {
    marginTop: 0,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dateBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  dateHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
  },
});
