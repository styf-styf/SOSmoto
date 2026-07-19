import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { FeedCatalogStrip } from '../../../../components/FeedCatalogStrip';
import { PhotoCarousel } from '../../../../components/PhotoCarousel';
import { ReportModal } from '../../../../components/ReportModal';
import { useAuth } from '../../../../hooks/useAuth';
import { getServiceAppointmentStats } from '../../../../services/appointments';
import { getMyWorkBusiness } from '../../../../services/businesses';
import { getServiceById, getServicesByCategory, incrementServiceViews } from '../../../../services/catalog';
import { createReport } from '../../../../services/reports';
import { consumeProductoServicioResetFlag } from '../../../../utils/productoServicioStackReset';
import type { ServiceWithBusiness, FeedCatalogItem } from '../../../../services/catalog';

export default function BusinessServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const navigation = useNavigation();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedItems, setRelatedItems] = useState<FeedCatalogItem[]>([]);
  const [isOwnService, setIsOwnService] = useState(false);
  const [stats, setStats] = useState<{ reservations: number; completed: number } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [result, work] = await Promise.all([
      getServiceById(id),
      profile ? getMyWorkBusiness(profile.id) : Promise.resolve(null),
    ]);
    setService(result);
    if (result) {
      incrementServiceViews(id).catch((err) => console.error('increment service views error', err));
      getServicesByCategory(result.category_id, id)
        .then(setRelatedItems)
        .catch((err) => console.error('load related services error', err));
    }

    const owns = !!(work && result && work.business.id === result.business_id);
    setIsOwnService(owns);
    if (owns && result) {
      getServiceAppointmentStats(result.id)
        .then(setStats)
        .catch((err) => console.error('load service stats error', err));
    }
  }, [id, profile]);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      load()
        .catch((err) => console.error('load service detail error', err))
        .finally(() => setLoading(false));
    } else {
      load().catch((err) => console.error('load service detail background refresh error', err));
    }
  }, [load]);

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

  if (loading) {
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

  function handleShare() {
    if (!service) return;
    const url = `https://so-smoto.vercel.app/service/${service.id}`;
    Share.share({ message: `${service.name}\n${url}`, url }).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: service.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              {isOwnService && (
                <Pressable onPress={handleShare} hitSlop={8}>
                  <Ionicons name="share-social-outline" size={22} color={colors.text} />
                </Pressable>
              )}
              {isOwnService ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(business)/(tabs)/catalogo', params: { editId: service.id, editKind: 'service' } })
                  }
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowReportModal(true)} hitSlop={8}>
                  <Ionicons name="flag-outline" size={22} color={colors.text} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <Pressable
        style={styles.businessRow}
        onPress={() => router.push(`/(business)/business/${service.business_id}`)}
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
      {service.category_name && <Text style={styles.category}>{service.category_name}</Text>}

      <Text style={styles.price}>
        {service.reference_price !== null ? `$${service.reference_price.toFixed(2)}` : 'Precio a consultar'}
      </Text>

      {service.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>
      )}

      {isOwnService ? (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{service.views}</Text>
            <Text style={styles.statLabel}>Vistas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.reservations ?? 0}</Text>
            <Text style={styles.statLabel}>Citas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.completed ?? 0}</Text>
            <Text style={styles.statLabel}>Completadas</Text>
          </View>
        </View>
      ) : (
        <View style={styles.buttonGroup}>
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              No puedes agendar citas con una cuenta de negocio. Cambia a una cuenta de cliente para solicitar este servicio.
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/(business)/business/${service.business_id}`)}>
              <Ionicons name="storefront-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Ver negocio</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/(business)/negocio-catalogo/${service.business_id}`)}>
              <Ionicons name="grid-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Ver catálogo</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                const msg = encodeURIComponent(`Hola, estoy interesado en el servicio "${service.name}". ¿Podrían darme más información?`);
                router.push(`/(business)/chat/${service.business_owner_id}?prefill=${msg}`);
              }}
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
      )}

      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[styles.sectionTitle, styles.relatedSectionTitle]}>También te puede interesar</Text>
          <FeedCatalogStrip
            items={relatedItems.filter((item) => item.photoUrl)}
            listItems={relatedItems.filter((item) => !item.photoUrl)}
            role="business"
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    // El header lo renderiza react-native-screens (nativo), no el
    // HeaderButton de @react-navigation/elements -- ese valor (8) no era el
    // real y quedó pegado al borde. Subido a mano según feedback visual.
    marginRight: 20,
  },
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
  category: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
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
});
