import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { createAppointment } from '../../services/appointments';
import { getBusinessById } from '../../services/businesses';
import { getActiveServices } from '../../services/catalog';
import { getVehicles } from '../../services/vehicles';
import type { Business, Service, Vehicle } from '../../types/database';

export default function AgendarScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { profile } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId || !profile) return;
    const [businessResult, serviceList, vehicleList] = await Promise.all([
      getBusinessById(businessId),
      getActiveServices(businessId),
      getVehicles(profile.id),
    ]);
    setBusiness(businessResult);
    setServices(serviceList);
    setVehicles(vehicleList);
    setSelectedVehicleId((prev) => prev ?? vehicleList[0]?.id ?? null);
  }, [businessId, profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load agendar error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSubmit() {
    if (!profile || !businessId) return;

    setSaving(true);
    try {
      await createAppointment({
        clientId: profile.id,
        businessId,
        vehicleId: selectedVehicleId ?? undefined,
        serviceId: selectedServiceId ?? undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Solicitud enviada', 'El taller agendará una fecha y te avisaremos para que la apruebes.', [
        { text: 'OK', onPress: () => router.replace('/(client)/citas') },
      ]);
    } catch (err) {
      console.error('create appointment error', err);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.placeholder}>{business?.name}</Text>
      <Text style={styles.hint}>
        Elige el servicio que necesitas. El taller te propondrá una fecha y hora, y podrás aprobarla o rechazarla.
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

      <Button title="Solicitar cita" onPress={handleSubmit} loading={saving} style={styles.submitButton} />
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
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
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
  },
  submitButton: {
    marginTop: 8,
  },
});
