import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import MapView from 'react-native-maps';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { CircleActionButton } from '../../../components/CircleActionButton';
import {
  InfoButton,
  InfoExample,
  InfoModal,
  InfoStep,
  infoTextStyles,
} from '../../../components/InfoModal';
import { MapNamedMarker } from '../../../components/MapNamedMarker';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useActiveHelpRequestContext } from '../../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getBusinessById } from '../../../services/businesses';
import {
  cancelHelpRequest,
  completeHelpRequest,
  createHelpRequest,
  getNearbyWorkshops,
  getNotifiedWorkshopsCount,
  wasNotifiedOutOfRange,
} from '../../../services/helpRequests';
import { createReview } from '../../../services/reviews';
import { getVehicles } from '../../../services/vehicles';
import type { Business, HelpRequest, Vehicle } from '../../../types/database';
import { distanceKm } from '../../../utils/distance';

const statusLabel: Record<HelpRequest['status'], string> = {
  pending: 'Buscando talleres cercanos…',
  accepted: 'Un taller va en camino',
  in_progress: 'Auxilio en progreso',
  completed: 'Auxilio completado',
  cancelled: 'Solicitud cancelada',
};

export default function AuxilioScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { coords, getCoords, refresh: refreshLocation } = useLocation();
  const {
    activeRequest,
    setActiveRequest,
    completedRequest,
    clearCompletedRequest,
    refresh: refreshActiveRequest,
  } = useActiveHelpRequestContext();

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [nearbyWorkshops, setNearbyWorkshops] = useState<Business[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [notifiedCount, setNotifiedCount] = useState<number | null>(null);
  const [outOfRange, setOutOfRange] = useState(false);
  const [reopenedNotice, setReopenedNotice] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const isMounted = useRef(false);
  const didInitialLoadRef = useRef(false);
  const prevAcceptedBusinessIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeRequest) {
      prevAcceptedBusinessIdRef.current = null;
      setReopenedNotice(null);
      return;
    }
    const currentBusinessId = activeRequest.accepted_business_id ?? null;
    if (
      prevAcceptedBusinessIdRef.current &&
      !currentBusinessId &&
      activeRequest.status === 'pending'
    ) {
      setReopenedNotice(
        'El taller anterior canceló tu solicitud. Buscando otro taller cercano…',
      );
    } else if (currentBusinessId) {
      setReopenedNotice(null);
    }
    prevAcceptedBusinessIdRef.current = currentBusinessId;
  }, [activeRequest?.accepted_business_id, activeRequest?.status]);
  useFocusEffect(
    useCallback(() => {
      // Omitir el primer focus (el mount inicial ya carga la ubicación)
      if (!isMounted.current) {
        isMounted.current = true;
        return;
      }
      if (!activeRequest) refreshLocation();
      // Red de seguridad por si el evento realtime de "el taller completó/canceló"
      // no llegó mientras la pantalla no tenía foco.
      refreshActiveRequest();
    }, [activeRequest, refreshLocation, refreshActiveRequest]),
  );

  useEffect(() => {
    if (!coords) return;
    getNearbyWorkshops(coords.latitude, coords.longitude)
      .then(setNearbyWorkshops)
      .catch((err) => console.error('load nearby workshops error', err));
  }, [coords]);

  useEffect(() => {
    if (!activeRequest?.accepted_business_id) {
      setBusiness(null);
      return;
    }
    getBusinessById(activeRequest.accepted_business_id)
      .then(setBusiness)
      .catch((err) => console.error('load business error', err));
  }, [activeRequest?.accepted_business_id]);

  useEffect(() => {
    if (!activeRequest || activeRequest.status !== 'pending') {
      setNotifiedCount(null);
      setOutOfRange(false);
      return;
    }
    let cancelled = false;
    getNotifiedWorkshopsCount(activeRequest.id)
      .then((count) => {
        if (!cancelled) setNotifiedCount(count);
      })
      .catch((err) => console.error('load notified count error', err));
    wasNotifiedOutOfRange(activeRequest.id)
      .then((value) => {
        if (!cancelled) setOutOfRange(value);
      })
      .catch((err) => console.error('load out of range error', err));
    return () => {
      cancelled = true;
    };
  }, [activeRequest?.id, activeRequest?.status]);

  const loadVehicles = useCallback(async () => {
    if (!profile) return;
    const vehicleList = await getVehicles(profile.id);
    setVehicles(vehicleList);
    setSelectedVehicleId((prev) => prev ?? vehicleList[0]?.id ?? null);
  }, [profile]);

  // loadVehicles depende de profile, que arranca en null hasta que la sesión
  // resuelve -- eso volvía a tapar toda la pantalla con el spinner apenas
  // el perfil llegaba. Solo se hace la primera vez.
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      loadVehicles()
        .catch((err) => console.error('load auxilio error', err))
        .finally(() => setLoading(false));
    } else {
      loadVehicles().catch((err) =>
        console.error('load auxilio background refresh error', err),
      );
    }
  }, [loadVehicles]);

  function handleLocate() {
    if (!coords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  }

  async function handleRequest() {
    if (!profile || !selectedVehicleId) {
      Alert.alert(
        'Falta información',
        'Selecciona una moto antes de pedir auxilio.',
      );
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
        'Activa el GPS y el permiso de ubicación para que los talleres puedan encontrarte, luego intenta de nuevo.',
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

  async function handleCompleteFromClient() {
    if (!activeRequest) return;
    try {
      await completeHelpRequest(activeRequest.id, 'client');
      await refreshActiveRequest();
    } catch (err) {
      console.error('complete help request error (client)', err);
      Alert.alert('Error', 'No se pudo marcar como completado.');
    }
  }

  function handleCall() {
    if (!business?.phone) return;
    Linking.openURL(`tel:${business.phone}`);
  }

  function handleChat() {
    if (!business) return;
    router.push(`/(client)/chat/${business.id}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (completedRequest) {
    return (
      <CompletedRequestCard
        request={completedRequest}
        onDone={clearCompletedRequest}
      />
    );
  }

  if (!activeRequest && vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>
          Agrega una moto antes de pedir auxilio.
        </Text>
        <Button
          title="Agregar moto"
          onPress={() => router.push('/(client)/vehiculos')}
          style={styles.addVehicleButton}
        />
      </View>
    );
  }

  const myMapCoords = activeRequest
    ? { latitude: activeRequest.latitude, longitude: activeRequest.longitude }
    : coords;
  const businessCoords = !activeRequest
    ? null
    : activeRequest.business_latitude !== null &&
        activeRequest.business_longitude !== null
      ? {
          latitude: activeRequest.business_latitude,
          longitude: activeRequest.business_longitude,
        }
      : business
        ? { latitude: business.latitude, longitude: business.longitude }
        : null;
  const businessIsLive =
    !!activeRequest &&
    activeRequest.business_latitude !== null &&
    activeRequest.business_longitude !== null;
  const businessDistanceKm =
    activeRequest && businessCoords
      ? distanceKm(
          activeRequest.latitude,
          activeRequest.longitude,
          businessCoords.latitude,
          businessCoords.longitude,
        )
      : null;
  const businessLabel = businessIsLive
    ? `${business?.name ?? 'Taller'} (en camino)`
    : (business?.name ?? 'Taller');

  return (
    <View style={styles.screen}>
      <View style={[styles.infoBtnWrap, { top: insets.top + 12 }]}>
        <InfoButton
          onPress={() => setShowInfo(true)}
          accessibilityLabel="Cómo funciona el auxilio en carretera"
        />
      </View>
      {myMapCoords ? (
        <View style={styles.mapContainer}>
          <MapView
            key={activeRequest ? 'active' : 'idle'}
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: myMapCoords.latitude,
              longitude: myMapCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <MapNamedMarker
              coordinate={myMapCoords}
              label="Tú"
              color={colors.sos}
              avatarUrl={profile?.avatar_url}
              fallbackIcon="person"
              zIndex={1}
            />
            {activeRequest
              ? businessCoords &&
                business && (
                  <MapNamedMarker
                    key={businessLabel}
                    coordinate={businessCoords}
                    label={businessLabel}
                    color={colors.primary}
                    avatarUrl={business.logo_url}
                    fallbackIcon="storefront"
                    zIndex={2}
                  />
                )
              : nearbyWorkshops.map((workshop) => (
                  <MapNamedMarker
                    key={workshop.id}
                    coordinate={{
                      latitude: workshop.latitude,
                      longitude: workshop.longitude,
                    }}
                    label={workshop.name}
                    color={colors.primary}
                    avatarUrl={workshop.logo_url}
                    fallbackIcon="storefront"
                  />
                ))}
          </MapView>
          <Pressable style={styles.locateBtn} onPress={handleLocate}>
            <Ionicons name="locate" size={22} color={colors.primary} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.mapContainer, styles.center]}>
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
          {activeRequest ? (
            <View style={styles.activeCard}>
              <Text style={styles.statusTitle}>
                {statusLabel[activeRequest.status]}
              </Text>

              {reopenedNotice && (
                <Text style={styles.reopenedNotice}>{reopenedNotice}</Text>
              )}

              {activeRequest.status === 'pending' && (
                <>
                  <ActivityIndicator
                    color={colors.primary}
                    style={styles.statusSpinner}
                  />
                  <Text style={styles.statusDetail}>
                    {notifiedCount === null
                      ? 'Buscando talleres cercanos…'
                      : notifiedCount > 0
                        ? `Notificamos a ${notifiedCount} taller${notifiedCount === 1 ? '' : 'es'} cercano${notifiedCount === 1 ? '' : 's'}.`
                        : 'No encontramos talleres cercanos disponibles por ahora. Tu solicitud sigue activa.'}
                  </Text>
                  {notifiedCount !== null &&
                    notifiedCount > 0 &&
                    outOfRange && (
                      <Text style={styles.statusDetailMuted}>
                        Ningún taller cubre tu zona habitualmente; notificamos a
                        los más cercanos disponibles, podrían tardar un poco más
                        en responder.
                      </Text>
                    )}
                </>
              )}

              {business && (
                <View style={styles.businessCard}>
                  <Text style={styles.businessName}>{business.name}</Text>
                  {businessDistanceKm !== null && (
                    <Text style={styles.businessMeta}>
                      Distancia:{' '}
                      {businessDistanceKm < 1
                        ? `${Math.round(businessDistanceKm * 1000)} m`
                        : `${businessDistanceKm.toFixed(1)} km`}
                    </Text>
                  )}
                  {activeRequest.estimated_arrival_minutes !== null && (
                    <Text style={styles.businessMeta}>
                      Llega en ~{activeRequest.estimated_arrival_minutes} min
                    </Text>
                  )}
                  {business.phone && (
                    <Pressable
                      style={styles.businessActionButton}
                      onPress={handleCall}
                    >
                      <Ionicons
                        name="call-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.businessActionText}>Llamar</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.circleActionsRow}>
                <CircleActionButton
                  icon="close"
                  label="Cancelar"
                  color={colors.danger}
                  onPress={handleCancel}
                />
                {business && (
                  <>
                    <CircleActionButton
                      icon="chatbubble-outline"
                      label="Chat"
                      color={colors.primary}
                      variant="outline"
                      onPress={handleChat}
                    />
                    <CircleActionButton
                      icon="checkmark"
                      label="Completar"
                      color={colors.primary}
                      onPress={handleCompleteFromClient}
                    />
                  </>
                )}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Tu moto</Text>
              <View style={styles.vehicleSelector}>
                {vehicles.map((vehicle) => (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => setSelectedVehicleId(vehicle.id)}
                    style={[
                      styles.vehicleOption,
                      selectedVehicleId === vehicle.id &&
                        styles.vehicleOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.vehicleOptionText,
                        selectedVehicleId === vehicle.id &&
                          styles.vehicleOptionTextSelected,
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
            </>
          )}
        </ScrollView>

        {!activeRequest && (
          <View style={styles.bottomBar}>
            <Button
              title={locating ? 'Obteniendo tu ubicación…' : 'Pedir auxilio'}
              onPress={handleRequest}
              loading={submitting}
              style={styles.sosButton}
            />
          </View>
        )}
      </KeyboardStickyView>

      <InfoModal
        visible={showInfo}
        title="Cómo funciona el auxilio en carretera"
        onClose={() => setShowInfo(false)}
      >
        <InfoStep number={1} title="Pides ayuda">
          <Text style={infoTextStyles.text}>
            Eliges tu moto, describes qué pasó (opcional) y tocas "Pedir
            auxilio". Tu ubicación GPS se comparte automáticamente con los
            talleres cercanos.
          </Text>
          <InfoExample label="Ejemplo">
            <Text style={infoTextStyles.exampleText}>
              Moto: "Yamaha FZ" · "Se quedó sin batería"
            </Text>
          </InfoExample>
        </InfoStep>

        <InfoStep number={2} title="Talleres cercanos reciben tu solicitud">
          <Text style={infoTextStyles.text}>
            Se notifica a <Text style={infoTextStyles.bold}>todos</Text> los
            talleres cuyo radio de cobertura te alcanza, no solo al más cercano.
            Verás cuántos fueron notificados mientras esperas.
          </Text>
        </InfoStep>

        <InfoStep number={3} title="Un taller acepta">
          <Text style={infoTextStyles.text}>
            En cuanto un taller acepta, la solicitud se cierra para los demás.
            Verás su nombre, ubicación en el mapa, y podrás llamarlo o
            escribirle por chat.
          </Text>
        </InfoStep>

        <InfoStep number={4} title='El "Llega en ~X min" se calcula solo'>
          <Text style={infoTextStyles.text}>
            Apenas el taller comparte su ubicación en vivo, el tiempo estimado
            se calcula automáticamente (por Google Maps) y se va actualizando
            mientras se mueve hacia ti -- no lo escribe nadie a mano.
          </Text>
          <InfoExample label="Importante" ok={false}>
            <Text style={infoTextStyles.exampleText}>
              Si el taller todavía no activó su ubicación en vivo, es normal que
              no veas un tiempo estimado apenas acepta -- aparecerá en cuanto la
              active.
            </Text>
          </InfoExample>
        </InfoStep>

        <InfoStep number={5} title="Puedes cancelar en cualquier momento">
          <Text style={infoTextStyles.text}>
            Mientras el taller no haya llegado (mientras el estado sea "Buscando
            talleres" o "Un taller va en camino"), puedes cancelar la solicitud
            con el botón de abajo.
          </Text>
        </InfoStep>

        <InfoStep number={6} title="Al terminar, calificas al taller">
          <Text style={infoTextStyles.text}>
            Tu calificación ayuda a otros motociclistas a elegir taller, y ayuda
            al taller a aparecer mejor posicionado en las búsquedas.
          </Text>
        </InfoStep>
      </InfoModal>
    </View>
  );
}

function CompletedRequestCard({
  request,
  onDone,
}: {
  request: HelpRequest;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request.accepted_business_id) return;
    getBusinessById(request.accepted_business_id)
      .then(setBusiness)
      .catch((err) => console.error('load business error', err));
  }, [request.accepted_business_id]);

  async function handleSubmit() {
    if (!profile || !request.accepted_business_id) return;
    setSaving(true);
    try {
      await createReview({
        reviewerId: profile.id,
        businessId: request.accepted_business_id,
        helpRequestId: request.id,
        rating,
        comment: comment.trim() || undefined,
      });
      onDone();
    } catch (err) {
      console.error('create review error', err);
      Alert.alert('Error', 'No se pudo enviar la calificación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.center}>
      <Text style={styles.statusTitle}>Auxilio completado</Text>
      <View style={styles.businessCard}>
        <Text style={styles.businessName}>
          ¿Cómo te fue con {business?.name ?? 'el taller'}?
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} onPress={() => setRating(value)}>
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={28}
                color={colors.warning}
              />
            </Pressable>
          ))}
        </View>
        <TextField
          label="Comentario (opcional)"
          value={comment}
          onChangeText={setComment}
        />
        <View style={styles.businessActions}>
          <Button
            title="Enviar"
            onPress={handleSubmit}
            loading={saving}
            style={styles.flexButton}
          />
          <Button
            title="Omitir"
            variant="secondary"
            onPress={onDone}
            style={styles.flexButton}
          />
        </View>
      </View>
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
  mapContainer: {
    flex: 1,
    width: '100%',
  },
  infoBtnWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    elevation: 10,
  },
  locateBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  keyboardStickyWrap: {
    backgroundColor: colors.background,
  },
  formScroll: {
    maxHeight: 340,
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
  statusDetailMuted: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  reopenedNotice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
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
  activeCard: {
    backgroundColor: '#FFF1E6',
    borderRadius: 12,
    padding: 16,
  },
  circleActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  businessActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  flexButton: {
    flex: 1,
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
});
