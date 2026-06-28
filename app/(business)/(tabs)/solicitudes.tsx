import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView from 'react-native-maps';
import { Button } from '../../../components/Button';
import { MapNamedMarker } from '../../../components/MapNamedMarker';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLiveLocationSharing } from '../../../hooks/useLiveLocationSharing';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getMyEmployeeRecord } from '../../../services/employees';
import {
  acceptHelpRequest,
  completeHelpRequest,
  getActiveBusinessRequest,
  getPendingRequests,
  rejectHelpRequest,
  subscribeToBusinessRequests,
  updateHelpRequestBusinessLocation,
  type PendingHelpRequest,
} from '../../../services/helpRequests';
import { createClientReview } from '../../../services/reviews';
import type { HelpRequest } from '../../../types/database';

export default function SolicitudesScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [canAccept, setCanAccept] = useState(true);
  const [pending, setPending] = useState<PendingHelpRequest[]>([]);
  const [active, setActive] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const [ratingTarget, setRatingTarget] = useState<HelpRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async (id: string) => {
    const [pendingList, activeRequest] = await Promise.all([
      getPendingRequests(id),
      getActiveBusinessRequest(id),
    ]);
    setPending(pendingList);
    setActive(activeRequest);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getMyWorkBusiness(profile.id)
      .then(async (work) => {
        if (!work) return;
        setBusinessId(work.business.id);
        if (work.isOwner) {
          setCanAccept(true);
        } else {
          const employeeRecord = await getMyEmployeeRecord(work.business.id, profile.id);
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
      load(businessId).catch((err) => console.error('reload after realtime error', err));
    });
    return unsubscribe;
  }, [businessId, load]);

  useLiveLocationSharing(!!active, (coords) => {
    if (!active) return;
    setActive((prev) =>
      prev ? { ...prev, business_latitude: coords.latitude, business_longitude: coords.longitude } : prev
    );
    updateHelpRequestBusinessLocation(active.id, coords.latitude, coords.longitude).catch((err) =>
      console.error('update business location error', err)
    );
  });

  async function handleComplete() {
    if (!active) return;
    try {
      await completeHelpRequest(active.id);
      setRatingTarget(active);
      setRating(5);
      setComment('');
      setActive(null);
    } catch (err) {
      console.error('complete help request error', err);
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
        <Text style={styles.placeholder}>Crea tu negocio primero, en la pestaña Inicio.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Solicitudes de auxilio</Text>

      {active && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Auxilio en curso</Text>
          <Text style={styles.activeMeta}>{active.description ?? 'Sin descripción'}</Text>
          {active.estimated_arrival_minutes !== null && (
            <Text style={styles.activeMeta}>ETA informado: {active.estimated_arrival_minutes} min</Text>
          )}

          <MapView
            style={styles.map}
            initialRegion={{
              latitude: active.latitude,
              longitude: active.longitude,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
          >
            <MapNamedMarker
              coordinate={{ latitude: active.latitude, longitude: active.longitude }}
              label="Cliente"
              color={colors.sos}
            />
            {active.business_latitude !== null && active.business_longitude !== null && (
              <MapNamedMarker
                coordinate={{ latitude: active.business_latitude, longitude: active.business_longitude }}
                label="Tu ubicación"
                color={colors.primary}
              />
            )}
          </MapView>

          <Button title="Marcar completado" onPress={handleComplete} style={styles.completeButton} />
        </View>
      )}

      {ratingTarget && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Califica al cliente</Text>
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
            <Button title="Enviar" onPress={handleSubmitReview} loading={savingReview} style={styles.flexButton} />
            <Button title="Omitir" variant="secondary" onPress={dismissReview} style={styles.flexButton} />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Pendientes</Text>
      {pending.length === 0 ? (
        <Text style={styles.placeholder}>No tienes solicitudes pendientes.</Text>
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
    </ScrollView>
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
  const [accepting, setAccepting] = useState(false);
  const [eta, setEta] = useState('15');
  const [saving, setSaving] = useState(false);

  async function handleAccept() {
    const parsed = Number(eta);
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Tiempo inválido', 'Ingresa un número de minutos válido.');
      return;
    }
    setSaving(true);
    try {
      await acceptHelpRequest({
        helpRequestId: item.helpRequest.id,
        businessId,
        estimatedArrivalMinutes: parsed,
      });
      onResolved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.';
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
      {item.client?.phone && <Text style={styles.cardMeta}>{item.client.phone}</Text>}
      <Text style={styles.cardMeta}>{item.helpRequest.description ?? 'Sin descripción'}</Text>

      {accepting ? (
        <View style={styles.etaRow}>
          <TextField label="ETA (min)" keyboardType="numeric" value={eta} onChangeText={setEta} />
          <View style={styles.actionsRow}>
            <Button title="Confirmar" onPress={handleAccept} loading={saving} style={styles.flexButton} />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setAccepting(false)}
              style={styles.flexButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          {canAccept && (
            <Button title="Aceptar" onPress={() => setAccepting(true)} style={styles.flexButton} />
          )}
          <Button
            title="Rechazar"
            variant="secondary"
            onPress={handleReject}
            loading={saving}
            style={styles.flexButton}
          />
        </View>
      )}
      {!canAccept && (
        <Text style={styles.noPermission}>No tienes permiso para aceptar auxilios. Pídele acceso al dueño.</Text>
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
  container: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
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
  completeButton: {
    marginTop: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  map: {
    height: 180,
    borderRadius: 12,
    marginTop: 12,
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
  etaRow: {
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
  noPermission: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
  },
});
