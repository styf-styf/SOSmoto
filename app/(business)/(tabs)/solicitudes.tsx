import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import MapView from 'react-native-maps';
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
import { useAuth } from '../../../hooks/useAuth';
import { useLiveLocationSharing } from '../../../hooks/useLiveLocationSharing';
import { useLocation } from '../../../hooks/useLocation';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getMyEmployeeRecord } from '../../../services/employees';
import {
  acceptHelpRequest,
  businessCancelAcceptedRequest,
  completeHelpRequest,
  getActiveBusinessRequest,
  getHelpRequestById,
  getPendingRequests,
  rejectHelpRequest,
  subscribeToBusinessRequests,
  subscribeToHelpRequest,
  triggerEtaUpdate,
  updateHelpRequestBusinessLocation,
  type PendingHelpRequest,
} from '../../../services/helpRequests';
import { createClientReview } from '../../../services/reviews';
import { getUserById } from '../../../services/users';
import { formatVehicle } from '../../../types/database';
import type { Business, HelpRequest } from '../../../types/database';
import { distanceKm } from '../../../utils/distance';

export default function SolicitudesScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { coords: myCoords } = useLocation();
  const mapRef = useRef<MapView>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [canAccept, setCanAccept] = useState(true);
  const [pending, setPending] = useState<PendingHelpRequest[]>([]);
  const [active, setActive] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const [ratingTarget, setRatingTarget] = useState<HelpRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [locationSharingFailed, setLocationSharingFailed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeClientAvatar, setActiveClientAvatar] = useState<string | null>(
    null,
  );
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const [pendingList, activeRequest] = await Promise.all([
      getPendingRequests(id),
      getActiveBusinessRequest(id),
    ]);
    setPending(pendingList);
    setActive(activeRequest);
  }, []);

  const checkActiveTransition = useCallback(
    async (requestId: string, id: string) => {
      try {
        const updated = await getHelpRequestById(requestId);
        if (updated?.status === 'completed') {
          setRatingTarget(updated);
          setRating(5);
          setComment('');
        } else if (updated?.status === 'cancelled') {
          setCancelledNotice('El cliente canceló esta solicitud de auxilio.');
        }
      } catch (err) {
        console.error('check active request transition error', err);
      } finally {
        load(id).catch((err) =>
          console.error('reload after transition error', err),
        );
      }
    },
    [load],
  );

  useEffect(() => {
    if (active) setCancelledNotice(null);
  }, [active?.id]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getMyWorkBusiness(profile.id)
      .then(async (work) => {
        if (!work) return;
        setBusinessId(work.business.id);
        setBusiness(work.business);
        if (work.isOwner) {
          setCanAccept(true);
        } else {
          const employeeRecord = await getMyEmployeeRecord(
            work.business.id,
            profile.id,
          );
          setCanAccept(employeeRecord?.can_accept_aid_requests ?? false);
        }
        return load(work.business.id);
      })
      .catch((err) => console.error('load solicitudes error', err))
      .finally(() => setLoading(false));
  }, [profile, load]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessRequests(businessId, () => {
      load(businessId).catch((err) =>
        console.error('reload after realtime error', err),
      );
    });
    return unsubscribe;
  }, [businessId, load]);

  useEffect(() => {
    // subscribeToBusinessRequests solo escucha help_request_notifications --
    // si el cliente cancela, eso actualiza help_requests directamente y esa
    // tabla no cambia, así que sin esto el taller nunca se entera y se queda
    // viendo la solicitud como si siguiera activa.
    if (!active?.id || !businessId) return;
    const requestId = active.id;
    const unsubscribe = subscribeToHelpRequest(requestId, () => {
      checkActiveTransition(requestId, businessId);
    });
    return unsubscribe;
  }, [active?.id, businessId, checkActiveTransition]);

  useFocusEffect(
    useCallback(() => {
      // Red de seguridad por si el evento realtime de "el cliente canceló" o
      // "se completó" no llegó mientras la pantalla no tenía foco.
      if (!businessId) return;
      if (active?.id) {
        checkActiveTransition(active.id, businessId);
      } else {
        load(businessId).catch((err) =>
          console.error('reload on focus error', err),
        );
      }
    }, [businessId, active?.id, checkActiveTransition, load]),
  );

  useEffect(() => {
    setLocationSharingFailed(false);
  }, [active?.id]);

  useEffect(() => {
    if (!active?.client_id) {
      setActiveClientAvatar(null);
      return;
    }
    getUserById(active.client_id)
      .then((user) => setActiveClientAvatar(user?.avatar_url ?? null))
      .catch((err) => console.error('load client avatar error', err));
  }, [active?.client_id]);

  const etaTriggeredForRef = useRef<string | null>(null);

  useLiveLocationSharing(
    !!active,
    (coords) => {
      if (!active) return;
      setActive((prev) =>
        prev
          ? {
              ...prev,
              business_latitude: coords.latitude,
              business_longitude: coords.longitude,
            }
          : prev,
      );
      updateHelpRequestBusinessLocation(
        active.id,
        coords.latitude,
        coords.longitude,
      )
        .then(() => {
          // accepted_at cambia en cada aceptación nueva (incluso si el mismo
          // taller re-acepta la misma solicitud tras cancelarla) -- así el
          // ETA se dispara de una vez en vez de esperar el cron de 2 min.
          if (etaTriggeredForRef.current !== active.accepted_at) {
            etaTriggeredForRef.current = active.accepted_at;
            triggerEtaUpdate();
          }
        })
        .catch((err) => console.error('update business location error', err));
    },
    () => setLocationSharingFailed(true),
  );

  async function handleComplete() {
    if (!active) return;
    try {
      await completeHelpRequest(active.id, 'business');
      setRatingTarget(active);
      setRating(5);
      setComment('');
      setActive(null);
    } catch (err) {
      console.error('complete help request error', err);
    }
  }

  function handleChatWithClient() {
    if (!active) return;
    router.push(`/(business)/chat/${active.client_id}`);
  }

  async function handleCancelActive() {
    if (!active || !businessId) return;
    try {
      await businessCancelAcceptedRequest(
        active.id,
        businessId,
        business?.name,
      );
      setActive(null);
      if (businessId)
        load(businessId).catch((err) =>
          console.error('reload after cancel error', err),
        );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo cancelar la solicitud.';
      Alert.alert('Error', message);
    }
  }

  async function handleSubmitReview() {
    if (!ratingTarget || !profile) return;
    setSavingReview(true);
    try {
      await createClientReview({
        reviewerId: profile.id,
        clientId: ratingTarget.client_id,
        helpRequestId: ratingTarget.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setRatingTarget(null);
    } catch (err) {
      console.error('create client review error', err);
      Alert.alert('Error', 'No se pudo enviar la calificación.');
    } finally {
      setSavingReview(false);
    }
  }

  function dismissReview() {
    setRatingTarget(null);
  }

  function handleLocate() {
    if (!myCoords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: myCoords.latitude,
        longitude: myCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
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
        <Text style={styles.placeholder}>
          Crea tu negocio primero, en la pestaña Inicio.
        </Text>
      </View>
    );
  }

  if (ratingTarget) {
    return (
      <View style={styles.center}>
        <Text style={styles.screenTitle}>Auxilio completado</Text>
        <View style={styles.ratingCard}>
          <Text style={styles.cardName}>Califica al cliente</Text>
          <Text style={styles.activeMeta}>
            Calificación interna, no es pública. Ayuda a detectar clientes que
            cancelan o no se presentan.
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
            label="Comentario interno (opcional)"
            value={comment}
            onChangeText={setComment}
          />
          <View style={styles.actionsRow}>
            <Button
              title="Enviar"
              onPress={handleSubmitReview}
              loading={savingReview}
              style={styles.flexButton}
            />
            <Button
              title="Omitir"
              variant="secondary"
              onPress={dismissReview}
              style={styles.flexButton}
            />
          </View>
        </View>
      </View>
    );
  }

  const activeDistanceKm = !active
    ? null
    : active.business_latitude !== null && active.business_longitude !== null
      ? distanceKm(
          active.latitude,
          active.longitude,
          active.business_latitude,
          active.business_longitude,
        )
      : business
        ? distanceKm(
            active.latitude,
            active.longitude,
            business.latitude,
            business.longitude,
          )
        : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.infoBtnWrap, { top: insets.top + 12 }]}>
        <InfoButton
          onPress={() => setShowInfo(true)}
          accessibilityLabel="Cómo funciona la recepción de auxilios"
        />
      </View>

      {myCoords && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            key={active ? 'active' : 'pending'}
            style={StyleSheet.absoluteFill}
            initialRegion={
              active
                ? {
                    latitude: active.latitude,
                    longitude: active.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                  }
                : {
                    latitude: myCoords.latitude,
                    longitude: myCoords.longitude,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }
            }
          >
            {active ? (
              <>
                <MapNamedMarker
                  coordinate={{
                    latitude: active.latitude,
                    longitude: active.longitude,
                  }}
                  label="Cliente"
                  color={colors.sos}
                  avatarUrl={activeClientAvatar}
                  fallbackIcon="person"
                  zIndex={2}
                />
                {active.business_latitude !== null &&
                  active.business_longitude !== null && (
                    <MapNamedMarker
                      coordinate={{
                        latitude: active.business_latitude,
                        longitude: active.business_longitude,
                      }}
                      label="Tu ubicación"
                      color={colors.primary}
                      avatarUrl={business?.logo_url}
                      fallbackIcon="storefront"
                      zIndex={1}
                    />
                  )}
              </>
            ) : (
              <>
                <MapNamedMarker
                  coordinate={myCoords}
                  label="Tú"
                  color={colors.primary}
                  avatarUrl={business?.logo_url}
                  fallbackIcon="storefront"
                />
                {pending.map((item) => (
                  <MapNamedMarker
                    key={item.helpRequest.id}
                    coordinate={{
                      latitude: item.helpRequest.latitude,
                      longitude: item.helpRequest.longitude,
                    }}
                    label={item.client?.full_name ?? 'Cliente'}
                    color={colors.sos}
                    fallbackIcon="person"
                  />
                ))}
              </>
            )}
          </MapView>
          <Pressable style={styles.locateBtn} onPress={handleLocate}>
            <Ionicons name="locate" size={22} color={colors.primary} />
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.bottomScroll}
        contentContainerStyle={styles.container}
      >
        {active && (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>Auxilio en curso</Text>
            <Text style={styles.activeMeta}>
              {active.description ?? 'Sin descripción'}
            </Text>
            {activeDistanceKm !== null && (
              <Text style={styles.activeMeta}>
                Distancia:{' '}
                {activeDistanceKm < 1
                  ? `${Math.round(activeDistanceKm * 1000)} m`
                  : `${activeDistanceKm.toFixed(1)} km`}
              </Text>
            )}
            {active.estimated_arrival_minutes !== null && (
              <Text style={styles.activeMeta}>
                Tiempo de llegada estimado: {active.estimated_arrival_minutes}{' '}
                min
              </Text>
            )}
            {locationSharingFailed && (
              <Text style={styles.locationWarning}>
                No pudimos compartir tu ubicación en vivo (revisa el permiso/GPS
                de la app). El cliente no verá tu posición ni un ETA actualizado
                hasta que lo actives.
              </Text>
            )}

            <View style={styles.circleActionsRow}>
              <CircleActionButton
                icon="close"
                label="Cancelar"
                color={colors.danger}
                onPress={handleCancelActive}
              />
              <CircleActionButton
                icon="chatbubble-outline"
                label="Chat"
                color={colors.primary}
                variant="outline"
                onPress={handleChatWithClient}
              />
              <CircleActionButton
                icon="checkmark"
                label="Completar"
                color={colors.primary}
                onPress={handleComplete}
              />
            </View>
          </View>
        )}

        {!active && cancelledNotice && (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>Solicitud cancelada</Text>
            <Text style={styles.activeMeta}>{cancelledNotice}</Text>
          </View>
        )}

        {!active && (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Pendientes</Text>
            </View>

            {pending.length === 0 ? (
              <Text style={styles.placeholder}>
                No tienes solicitudes pendientes.
              </Text>
            ) : (
              pending.map((item) => (
                <RequestCard
                  key={item.notification.id}
                  item={item}
                  businessId={businessId}
                  canAccept={canAccept}
                  onResolved={() => businessId && load(businessId)}
                />
              ))
            )}
          </>
        )}

        <InfoModal
          visible={showInfo}
          title="Cómo funciona la recepción de auxilios"
          onClose={() => setShowInfo(false)}
        >
          <InfoStep
            number={1}
            title='El interruptor "Disponible para auxilios" se mudó'
          >
            <Text style={infoTextStyles.text}>
              Ahora está en Perfil → Datos del negocio → Auxilio en carretera,
              junto al radio de cobertura. Si lo apagas ahí, dejas de aparecer
              para clientes cercanos que piden auxilio nuevo -- tus solicitudes
              ya activas siguen normales, no se cancelan.
            </Text>
          </InfoStep>

          <InfoStep number={2} title="Quién recibe cada solicitud">
            <Text style={infoTextStyles.text}>
              Todos los talleres dentro del radio de cobertura del cliente
              reciben la solicitud al mismo tiempo -- no hay prioridad por plan
              (Free/Estándar/Pro). Solo tu radio de cobertura (Configuración →
              Auxilio en carretera) decide si te llega.
            </Text>
            <InfoExample label="Ejemplo">
              <Text style={infoTextStyles.exampleText}>
                "Fuera de tu radio de cobertura configurado" significa que nadie
                más cercano estaba disponible y te notificamos igual, por si
                puedes ayudar.
              </Text>
            </InfoExample>
          </InfoStep>

          <InfoStep
            number={3}
            title="El primero en aceptar se queda con la solicitud"
          >
            <Text style={infoTextStyles.text}>
              En cuanto tocas "Aceptar", la solicitud se cierra automáticamente
              para los demás talleres que la recibieron.
            </Text>
          </InfoStep>

          <InfoStep
            number={4}
            title='El "Tiempo de llegada estimado" se calcula solo'
          >
            <Text style={infoTextStyles.text}>
              Apenas aceptas, la app comparte tu ubicación GPS en vivo mientras
              la tengas abierta, y el tiempo estimado se recalcula
              automáticamente (Google Maps) mientras te acercas -- no lo
              escribes tú.
            </Text>
            <InfoExample label="Si ves la advertencia roja" ok={false}>
              <Text style={infoTextStyles.exampleText}>
                "No pudimos compartir tu ubicación en vivo" significa que el
                cliente no ve tu posición ni un ETA actualizado -- revisa el
                permiso de GPS de la app hasta que se resuelva.
              </Text>
            </InfoExample>
          </InfoStep>

          <InfoStep number={5} title='Al terminar, toca "Marcar completado"'>
            <Text style={infoTextStyles.text}>
              Eso te lleva a calificar al cliente -- una calificación interna,
              no pública, que sirve para detectar clientes que cancelan seguido
              o no se presentan.
            </Text>
          </InfoStep>

          <InfoStep
            number={6}
            title="Empleados: el permiso de aceptar es aparte"
          >
            <Text style={infoTextStyles.text}>
              Solo un empleado con el permiso "Aceptar auxilios" activado (en
              Equipo) puede tocar "Aceptar" -- si no lo ves, pídele al dueño que
              active ese permiso para tu cuenta.
            </Text>
          </InfoStep>
        </InfoModal>
      </ScrollView>
    </View>
  );
}

function RequestCard({
  item,
  businessId,
  canAccept,
  onResolved,
}: {
  item: PendingHelpRequest;
  businessId: string;
  canAccept: boolean;
  onResolved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      await acceptHelpRequest({
        helpRequestId: item.helpRequest.id,
        businessId,
      });
      onResolved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.';
      Alert.alert('Error', message);
      onResolved();
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    setSaving(true);
    try {
      await rejectHelpRequest(item.helpRequest.id, businessId);
      onResolved();
    } catch (err) {
      console.error('reject help request error', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{item.client?.full_name ?? 'Cliente'}</Text>
      {item.client?.phone && (
        <Text style={styles.cardMeta}>{item.client.phone}</Text>
      )}
      {item.vehicle && (
        <Text style={styles.cardMeta}>{formatVehicle(item.vehicle)}</Text>
      )}
      <Text style={styles.cardMeta}>
        {item.helpRequest.description ?? 'Sin descripción'}
      </Text>
      {item.notification.out_of_range && (
        <Text style={styles.outOfRangeNotice}>
          Fuera de tu radio de cobertura configurado — nadie más cercano estaba
          disponible.
        </Text>
      )}

      <View style={styles.circleActionsRow}>
        <CircleActionButton
          icon="close"
          label="Rechazar"
          color={colors.danger}
          onPress={handleReject}
          loading={saving}
        />
        {canAccept && (
          <CircleActionButton
            icon="checkmark"
            label="Aceptar"
            color={colors.primary}
            onPress={handleAccept}
            loading={saving}
          />
        )}
      </View>
      {!canAccept && (
        <Text style={styles.noPermission}>
          No tienes permiso para aceptar auxilios. Pídele acceso al dueño.
        </Text>
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
  infoBtnWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    elevation: 10,
  },
  mapContainer: {
    flex: 1,
    width: '100%',
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
  bottomScroll: {
    maxHeight: '45%',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    width: '100%',
  },
  activeCard: {
    backgroundColor: '#FFF1E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  activeMeta: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  locationWarning: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  circleActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  flexButton: {
    flex: 1,
  },
  noPermission: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
  },
  outOfRangeNotice: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 6,
  },
});
