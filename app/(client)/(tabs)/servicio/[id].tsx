import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { FeedCatalogStrip } from '../../../../components/FeedCatalogStrip';
import { PhotoCarousel } from '../../../../components/PhotoCarousel';
import { ReportModal } from '../../../../components/ReportModal';
import { colors } from '../../../../constants/colors';
import { useAuth } from '../../../../hooks/useAuth';
import { getServiceById, getServicesByCategory, incrementServiceViews } from '../../../../services/catalog';
import {
  cancelAppointmentRequest,
  getAppointmentRequestForService,
  subscribeToAppointmentRequest,
  type AppointmentRequest,
} from '../../../../services/appointmentRequests';
import { cancelAppointment, getActiveAppointmentForService } from '../../../../services/appointments';
import { createReport } from '../../../../services/reports';
import { consumeProductoServicioResetFlag } from '../../../../utils/productoServicioStackReset';
import type { ServiceWithBusiness, FeedCatalogItem } from '../../../../services/catalog';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const navigation = useNavigation();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedItems, setRelatedItems] = useState<FeedCatalogItem[]>([]);
  const [appointmentRequest, setAppointmentRequest] = useState<AppointmentRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmedAppointmentId, setConfirmedAppointmentId] = useState<string | null>(null);
  const [cancellingAppointment, setCancellingAppointment] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getServiceById(id);
    setService(result);
    if (result) {
      incrementServiceViews(id).catch((err) => console.error('increment service views error', err));
      getServicesByCategory(result.category_id, id)
        .then(setRelatedItems)
        .catch((err) => console.error('load related services error', err));
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load service detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  // Separado de `load`: profile arranca en null y se resuelve un instante
  // después -- si esto viviera dentro de `load` (que depende de profile),
  // cada resolución de profile volvía a disparar setLoading(true) sobre
  // toda la pantalla, y además duplicaba el incremento de vistas.
  useEffect(() => {
    if (!profile?.id || !service) return;
    let cancelled = false;
    (async () => {
      const req = await getAppointmentRequestForService(profile.id, service.business_id, service.id).catch((err) => {
        console.error('load appointment request error', err);
        return null;
      });
      if (cancelled) return;
      setAppointmentRequest(req);
      if (req?.status === 'accepted') {
        getActiveAppointmentForService(profile.id, service.business_id, service.id)
          .then((appt) => {
            if (!cancelled) setConfirmedAppointmentId(appt?.id ?? null);
          })
          .catch((err) => console.error('load confirmed appointment error', err));
      } else {
        setConfirmedAppointmentId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, service]);

  // Si el usuario volvió a Inicio antes de entrar acá, esta es la primera
  // pantalla de servicio que gana foco después de eso: reinicia la pila
  // anidada para que quede como única entrada (ver
  // utils/productoServicioStackReset.ts).
  useFocusEffect(
    useCallback(() => {
      if (consumeProductoServicioResetFlag('servicio')) {
        navigation.dispatch((state) => CommonActions.reset({ index: 0, routes: [state.routes[state.index]] } as any));
      }
    }, [navigation])
  );

  useEffect(() => {
    if (!profile?.id || !service?.business_id) return;
    return subscribeToAppointmentRequest(profile.id, service.business_id, 'client', (req) => {
      if (req.service_id !== service.id) return;
      if (req.status === 'accepted') {
        setAppointmentRequest(req);
        getActiveAppointmentForService(profile.id, service.business_id, service.id)
          .then((appt) => setConfirmedAppointmentId(appt?.id ?? null))
          .catch((err) => console.error('load confirmed appointment error', err));
      } else if (req.status === 'pending') {
        setAppointmentRequest(req);
        setConfirmedAppointmentId(null);
      } else {
        setAppointmentRequest(null);
        setConfirmedAppointmentId(null);
      }
    });
  }, [profile?.id, service?.business_id, service?.id]);

  async function handleCancelRequest() {
    if (!appointmentRequest) return;
    setCancelling(true);
    try {
      await cancelAppointmentRequest(appointmentRequest);
      setAppointmentRequest(null);
    } catch (err) {
      console.error('cancel appointment request error', err);
      Alert.alert('Error', 'No se pudo cancelar la solicitud. Intenta de nuevo.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleCancelAppointment() {
    if (!confirmedAppointmentId) return;
    setCancellingAppointment(true);
    try {
      await cancelAppointment(confirmedAppointmentId, 'client');
      setAppointmentRequest(null);
      setConfirmedAppointmentId(null);
    } catch (err) {
      console.error('cancel appointment error', err);
      Alert.alert('Error', 'No se pudo cancelar la cita. Intenta de nuevo.');
    } finally {
      setCancellingAppointment(false);
    }
  }

  useEffect(() => {
    if (profile && profile.role !== 'client' && id) {
      router.replace({ pathname: '/(business)/(tabs)/catalogo', params: { highlightId: id } });
    }
  }, [profile?.role, id]);

  if (loading || (profile && profile.role !== 'client')) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este servicio ya no está disponible.</Text>
      </View>
    );
  }

  function handleShare() {
    if (!service) return;
    const url = `https://so-smoto.vercel.app/service/${service.id}`;
    Share.share({ message: `${service.name}\n${url}`, url }).catch(() => {});
  }

  async function handleReportService(reason: string) {
    if (!service || !profile) return;
    try {
      await createReport(profile.id, 'service', service.id, reason);
      setShowReportModal(false);
      Alert.alert('Gracias', 'Reportaste este servicio. Un admin lo va a revisar.');
    } catch (err) {
      console.error('report service error', err);
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: service.name,
          headerRight: () => (
            <Pressable onPress={() => setShowReportModal(true)} hitSlop={8}>
              <Ionicons name="flag-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <Pressable
        style={styles.businessRow}
        onPress={() => router.push(`/(client)/business/${service.business_id}`)}
      >
        <View style={styles.businessAvatarWrap}>
          <View style={styles.businessAvatar}>
            {service.business_logo_url ? (
              <Image source={{ uri: service.business_logo_url }} style={styles.businessAvatarImage} />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
          </View>
          {service.business_is_verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            </View>
          )}
        </View>
        <Text style={styles.businessName} numberOfLines={1}>{service.business_name}</Text>
      </Pressable>
      <PhotoCarousel photos={service.photos} />
      <Text style={styles.name}>{service.name}</Text>

      <Text style={styles.price}>
        {service.reference_price !== null ? `$${service.reference_price.toFixed(2)}` : 'Precio a consultar'}
      </Text>

      {service.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        {!appointmentRequest ? (
          <Button
            title="Solicitar cita"
            onPress={() =>
              router.push({
                pathname: '/(client)/agendar',
                params: { businessId: service.business_id, serviceId: service.id },
              })
            }
            style={styles.apartarButton}
          />
        ) : appointmentRequest.status === 'accepted' ? (
          <>
            <Button
              title="Cancelar cita"
              onPress={handleCancelAppointment}
              loading={cancellingAppointment}
              disabled={!confirmedAppointmentId}
              style={styles.buttonCancel}
            />
            <Text style={[styles.intentBadge, styles.intentBadgeConfirmed]}>
              ✓ Cita confirmada por el taller
            </Text>
          </>
        ) : (
          <>
            <Button
              title="Cancelar solicitud"
              onPress={handleCancelRequest}
              loading={cancelling}
              style={styles.buttonCancel}
            />
            <Text style={styles.intentBadge}>
              Solicitud enviada — en espera de respuesta del taller
            </Text>
          </>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/business/${service.business_id}`)}>
            <Ionicons name="storefront-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver negocio</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/negocio-catalogo/${service.business_id}`)}>
            <Ionicons name="grid-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver catálogo</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              router.push({
                pathname: '/(client)/chat/[id]',
                params: { id: service.business_id, prefill: `Hola, estoy interesado en el servicio "${service.name}". ¿Podrían darme más información?` },
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Chatear</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Compartir</Text>
          </Pressable>
        </View>
      </View>

      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[styles.sectionTitle, styles.relatedSectionTitle]}>También te puede interesar</Text>
          <FeedCatalogStrip
            items={relatedItems.filter((item) => item.photoUrl)}
            listItems={relatedItems.filter((item) => !item.photoUrl)}
            role="client"
          />
        </View>
      )}

      <ReportModal
        visible={showReportModal}
        targetLabel="este servicio"
        onCancel={() => setShowReportModal(false)}
        onSubmit={handleReportService}
      />
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  businessAvatarWrap: {
    position: 'relative',
  },
  businessAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessAvatarImage: {
    width: 28,
    height: 28,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  businessName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  section: {
    marginTop: 24,
  },
  relatedSection: {
    marginTop: 28,
    marginHorizontal: -20,
  },
  relatedSectionTitle: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  buttonGroup: {
    marginTop: 32,
    gap: 10,
  },
  apartarButton: {
    height: 42,
  },
  buttonCancel: {
    backgroundColor: colors.danger,
  },
  intentBadge: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  intentBadgeConfirmed: {
    color: colors.success,
  },
  actionsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  button: {},
});
