import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapView from 'react-native-maps';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Button } from '../../../components/Button';
import { MapNamedMarker } from '../../../components/MapNamedMarker';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useActiveHelpRequestContext } from '../../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getBusinessById } from '../../../services/businesses';
import {
  cancelHelpRequest,
  createHelpRequest,
  getNearbyWorkshops,
  getNotifiedWorkshopsCount,
} from '../../../services/helpRequests';
import { getVehicles } from '../../../services/vehicles';
import type { Business, HelpRequest, Vehicle } from '../../../types/database';

const statusLabel: Record<HelpRequest['status'], string> = {
  pending: 'Buscando talleres cercanos…',
  accepted: 'Un taller va en camino',
  in_progress: 'Auxilio en progreso',
  completed: 'Auxilio completado',
  cancelled: 'Solicitud cancelada',
};

export default function AuxilioScreen() {
  const { profile } = useAuth();
  const { coords, getCoords } = useLocation();
  const { activeRequest, setActiveRequest } = useActiveHelpRequestContext();

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [nearbyWorkshops, setNearbyWorkshops] = useState<Business[]>([]);

  useEffect(() => {
    if (!coords) return;
    getNearbyWorkshops(coords.latitude, coords.longitude)
      .then(setNearbyWorkshops)
      .catch((err) => console.error('load nearby workshops error', err));
  }, [coords]);

  const loadVehicles = useCallback(async () => {
    if (!profile) return;
    const vehicleList = await getVehicles(profile.id);
    setVehicles(vehicleList);
    setSelectedVehicleId((prev) => prev ?? vehicleList[0]?.id ?? null);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    loadVehicles()
      .catch((err) => console.error('load auxilio error', err))
      .finally(() => setLoading(false));
  }, [loadVehicles]);

  async function handleRequest() {
    if (!profile || !selectedVehicleId) {
      Alert.alert('Falta información', 'Selecciona una moto antes de pedir auxilio.');
      return;
    }

    setSubmitting(true);
    setLocating(true);
    let coords;
    try {
      coords = await getCoords();
    } catch (err) {
      setLocating(false);
      setSubmitting(false);
      Alert.alert(
        'No pudimos ubicarte',
        'Activa el GPS y el permiso de ubicación para que los talleres puedan encontrarte, luego intenta de nuevo.'
      );
      return;
    }
    setLocating(false);

    try {
      const request = await createHelpRequest({
        clientId: profile.id,
        vehicleId: selectedVehicleId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        description: description.trim() || undefined,
      });
      setActiveRequest(request);
    } catch (err) {
      console.error('create help request error', err);
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!activeRequest) return;
    try {
      await cancelHelpRequest(activeRequest.id);
      setActiveRequest(null);
    } catch (err) {
      console.error('cancel help request error', err);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (activeRequest) {
    return <ActiveRequestCard request={activeRequest} onCancel={handleCancel} />;
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Agrega una moto antes de pedir auxilio.</Text>
        <Button
          title="Agregar moto"
          onPress={() => router.push('/(client)/vehiculos')}
          style={styles.addVehicleButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.compactTitle}>Auxilio en carretera</Text>

      {coords ? (
        <MapView
          style={styles.bigMap}
          initialRegion={{
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <MapNamedMarker coordinate={coords} label="Tú" color={colors.sos} />
          {nearbyWorkshops.map((workshop) => (
            <MapNamedMarker
              key={workshop.id}
              coordinate={{ latitude: workshop.latitude, longitude: workshop.longitude }}
              label={workshop.name}
              color={colors.primary}
            />
          ))}
        </MapView>
      ) : (
        <View style={[styles.bigMap, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.placeholder}>Obteniendo tu ubicación…</Text>
        </View>
      )}

      <KeyboardStickyView style={styles.keyboardStickyWrap}>
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>Tu moto</Text>
          <View style={styles.vehicleSelector}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                onPress={() => setSelectedVehicleId(vehicle.id)}
                style={[styles.vehicleOption, selectedVehicleId === vehicle.id && styles.vehicleOptionSelected]}
              >
                <Text
                  style={[
                    styles.vehicleOptionText,
                    selectedVehicleId === vehicle.id && styles.vehicleOptionTextSelected,
                  ]}
                >
                  {vehicle.brand} {vehicle.model}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="¿Qué pasó? (opcional)"
            placeholder="Ej: se quedó sin batería"
            value={description}
            onChangeText={setDescription}
          />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Button
            title={locating ? 'Obteniendo tu ubicación…' : 'Pedir auxilio'}
            onPress={handleRequest}
            loading={submitting}
            style={styles.sosButton}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function ActiveRequestCard({ request, onCancel }: { request: HelpRequest; onCancel: () => void }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [notifiedCount, setNotifiedCount] = useState<number | null>(null);

  useEffect(() => {
    if (request.accepted_business_id) {
      getBusinessById(request.accepted_business_id)
        .then(setBusiness)
        .catch((err) => console.error('load business error', err));
    }
  }, [request.accepted_business_id]);

  useEffect(() => {
    if (request.status !== 'pending') return;
    let cancelled = false;
    getNotifiedWorkshopsCount(request.id)
      .then((count) => {
        if (!cancelled) setNotifiedCount(count);
      })
      .catch((err) => console.error('load notified count error', err));
    return () => {
      cancelled = true;
    };
  }, [request.id, request.status]);

  function handleCall() {
    if (!business?.phone) return;
    Linking.openURL(`tel:${business.phone}`);
  }

  function handleChat() {
    if (!business) return;
    router.push(`/(client)/chat/${business.id}`);
  }

  const businessCoords =
    request.business_latitude !== null && request.business_longitude !== null
      ? { latitude: request.business_latitude, longitude: request.business_longitude }
      : business
        ? { latitude: business.latitude, longitude: business.longitude }
        : null;
  const businessIsLive = request.business_latitude !== null && request.business_longitude !== null;

  return (
    <View style={styles.center}>
      <Text style={styles.statusTitle}>{statusLabel[request.status]}</Text>

      {request.status === 'pending' && (
        <>
          <ActivityIndicator color={colors.primary} style={styles.statusSpinner} />
          <Text style={styles.statusDetail}>
            {notifiedCount === null
              ? 'Buscando talleres cercanos…'
              : notifiedCount > 0
                ? `Notificamos a ${notifiedCount} taller${notifiedCount === 1 ? '' : 'es'} cercano${notifiedCount === 1 ? '' : 's'}.`
                : 'No encontramos talleres cercanos disponibles por ahora. Tu solicitud sigue activa.'}
          </Text>
        </>
      )}

      {(request.status === 'accepted' || request.status === 'in_progress') && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: request.latitude,
            longitude: request.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <MapNamedMarker
            coordinate={{ latitude: request.latitude, longitude: request.longitude }}
            label="Tú"
            color={colors.sos}
          />
          {businessCoords && (
            <MapNamedMarker
              coordinate={businessCoords}
              label={businessIsLive ? `${business?.name ?? 'Taller'} (en camino)` : business?.name ?? 'Taller'}
              color={colors.primary}
            />
          )}
        </MapView>
      )}

      {business && (
        <View style={styles.businessCard}>
          <Text style={styles.businessName}>{business.name}</Text>
          {request.estimated_arrival_minutes !== null && (
            <Text style={styles.businessMeta}>Llega en ~{request.estimated_arrival_minutes} min</Text>
          )}
          <View style={styles.businessActions}>
            {business.phone && (
              <Pressable style={styles.businessActionButton} onPress={handleCall}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <Text style={styles.businessActionText}>Llamar</Text>
              </Pressable>
            )}
            <Pressable style={styles.businessActionButton} onPress={handleChat}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              <Text style={styles.businessActionText}>Chat</Text>
            </Pressable>
          </View>
        </View>
      )}

      {(request.status === 'pending' || request.status === 'accepted') && (
        <Button title="Cancelar solicitud" variant="secondary" onPress={onCancel} style={styles.cancelButton} />
      )}
    </View>
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  bigMap: {
    flex: 1,
    width: '100%',
  },
  keyboardStickyWrap: {
    backgroundColor: colors.background,
  },
  formScroll: {
    maxHeight: 220,
    flexGrow: 0,
  },
  formContent: {
    padding: 16,
    paddingBottom: 8,
  },
  bottomBar: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  vehicleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  vehicleOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  vehicleOptionText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  vehicleOptionTextSelected: {
    color: colors.primary,
  },
  map: {
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  sosButton: {
    backgroundColor: colors.sos,
    marginTop: 8,
  },
  addVehicleButton: {
    marginTop: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  statusSpinner: {
    marginTop: 16,
  },
  statusDetail: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  businessCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    width: '100%',
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  businessMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  businessActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  businessActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  businessActionText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 24,
    width: '100%',
  },
});
