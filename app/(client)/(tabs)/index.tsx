import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getNewNearbyBusinesses, getNearestCity, type BusinessWithDistance } from '../../../services/businesses';
import { getHomeMaintenanceAlerts, markCompleted, type MaintenanceAlert } from '../../../services/maintenance';
import {
  getSeenStoryIds,
  getVisibleBusinessStoriesFollowed,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  type StoryFeedItem,
} from '../../../services/stories';
import { CreatePostBox } from '../../../components/CreatePostBox';
import { HomeFeed, type HomeFeedHandle } from '../../../components/HomeFeed';
import { StoriesRow } from '../../../components/StoriesRow';
import { clearLimitedMark, markLimited, wasPreviouslyLimited } from '../../../utils/accountLimit';
import { markProductoServicioStacksForReset } from '../../../utils/productoServicioStackReset';

const SCREEN_WIDTH = Dimensions.get('window').width;
const bizTypeLabel: Record<string, string> = { workshop: 'Taller', store: 'Tienda' };

export default function ClientHomeScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();
  const navigation = useNavigation();

  const [city, setCity] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [feedItemsFollowing, setFeedItemsFollowing] = useState<StoryFeedItem[]>([]);
  const [ownHasStory, setOwnHasStory] = useState(false);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [nearbyNew, setNearbyNew] = useState<BusinessWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const homeFeedRef = useRef<HomeFeedHandle>(null);
  const limitCheckedRef = useRef(false);
  const didInitialLoadRef = useRef(false);

  const dragX = useRef(new Animated.Value(0)).current;
  const siguiendoTranslateX = useRef(Animated.add(dragX, new Animated.Value(SCREEN_WIDTH))).current;

  useEffect(() => {
    if (!profile?.id || limitCheckedRef.current) return;
    limitCheckedRef.current = true;
    const key = `account_limited:${profile.id}`;
    (async () => {
      try {
        const wasLimited = await wasPreviouslyLimited(key);
        if (profile.is_limited) {
          await markLimited(key);
          Alert.alert(
            'Cuenta limitada',
            profile.limitation_reason
              ? `Tu cuenta está limitada: ${profile.limitation_reason}`
              : 'Tu cuenta está limitada. No puedes crear publicaciones, subir historias ni buscar talleres.'
          );
        } else if (wasLimited) {
          await clearLimitedMark(key);
          Alert.alert('Cuenta restablecida', 'Se quitó el límite de tu cuenta. Ya puedes usar la app con normalidad.');
        }
      } catch (err) {
        console.error('check account limit error', err);
      }
    })();
  }, [profile?.id, profile?.is_limited, profile?.limitation_reason]);

  const load = useCallback(async () => {
    try {
      setCity(await getNearestCity(coords));
      if (profile) {
        getHomeMaintenanceAlerts(profile.id)
          .then(setMaintenanceAlerts)
          .catch((err) => console.error('load maintenance alerts error', err));
      }

      const [businessStoriesGlobal, clientStoriesGlobal, newNearby, businessStoriesFollowed] = await Promise.all([
        getVisibleBusinessStoriesGlobal({ excludeBrand: true }),
        getVisibleClientStories(),
        getNewNearbyBusinesses(coords),
        profile ? getVisibleBusinessStoriesFollowed(profile.id) : Promise.resolve([]),
      ]);
      setNearbyNew(newNearby);

      const allStoryIds = [...businessStoriesGlobal.map((s) => s.id), ...clientStoriesGlobal.map((s) => s.id)];
      const seenIds = profile ? await getSeenStoryIds(profile.id, allStoryIds) : new Set<string>();
      const ownClientStory = clientStoriesGlobal.find((s) => s.client_id === profile?.id);
      setFeedItems(
        groupStoriesByAuthor({
          businessStories: businessStoriesGlobal,
          clientStories: clientStoriesGlobal,
          seenStoryIds: seenIds,
          excludeClientId: profile?.id,
        })
      );
      setFeedItemsFollowing(
        groupStoriesByAuthor({
          businessStories: businessStoriesFollowed,
          clientStories: [],
          seenStoryIds: seenIds,
          excludeClientId: profile?.id,
        })
      );
      setOwnHasStory(!!ownClientStory);
      setOwnPreviewImageUrl(ownClientStory?.image_url ?? null);
    } catch (err) {
      console.error('home load error', err);
    }
  }, [profile, coords]);

  // `load` depende de `profile`/`coords`, que arrancan en null y se resuelven
  // un instante después (perfil de sesión, permiso de GPS) -- eso cambia la
  // identidad de `load` y volvía a disparar este efecto con setLoading(true),
  // dando la sensación de que la pantalla "carga dos veces". Solo mostramos
  // el spinner de carga completa la primera vez; las veces siguientes (cuando
  // profile/coords ya están listos) se actualiza en silencio sobre el
  // contenido que ya está en pantalla.
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      load().finally(() => setLoading(false));
    } else {
      load().catch((err) => console.error('home background refresh error', err));
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Volver a Para ti cada vez que el tab Inicio gana foco (desde otro tab o pantalla anidada).
      // También reinicia la pila de producto/servicio -- esto cubre el caso de volver a Inicio
      // con el botón "atrás" del header (no solo tocando el ícono de la tab bar, que ya se
      // maneja aparte en el listener de tabPress más abajo).
      dragX.setValue(0);
      markProductoServicioStacksForReset();
      load().catch((err) => console.error('refresh client home error', err));
    }, [load])
  );

  // Mismo reset si el usuario ya está en Inicio y vuelve a presionar el botón del tab.
  // También reinicia la pila de producto/servicio (ver utils/productoServicioStackReset.ts).
  // "tabPress" se dispara tanto al re-tocar el tab ya activo como al venir de otro tab hacia
  // este -- en ese segundo caso useFocusEffect (arriba) YA hace un dragX.setValue(0) instantáneo
  // en el mismo instante, y como esta animación usa el native driver, las dos peleando por el
  // mismo valor dejaban la pantalla a medio camino, partida en dos. Si todavía no tenemos el foco,
  // es ese segundo caso -- se ignora acá porque useFocusEffect ya lo resuelve.
  useEffect(() => {
    return navigation.addListener('tabPress' as any, () => {
      if (!navigation.isFocused()) return;
      Animated.spring(dragX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 250,
        friction: 28,
        overshootClamping: true,
      }).start();
      markProductoServicioStacksForReset();
    });
  }, [navigation]);

  function switchTab(mode: 'all' | 'following') {
    Animated.spring(dragX, {
      toValue: mode === 'all' ? 0 : -SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 250,
      friction: 28,
      overshootClamping: true,
    }).start();
  }

  async function handleCompleteAlert(alert: MaintenanceAlert) {
    try {
      await markCompleted(alert.suggestionId, alert.vehicleMileage);
      setMaintenanceAlerts((prev) => prev.filter((a) => a.suggestionId !== alert.suggestionId));
    } catch (err) {
      console.error('complete maintenance alert error', err);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Para ti: todas las historias — título centrado con botón "Siguiendo →" en naranja a la derecha
  const sharedScrollHeader = (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerSide} />
        <Text style={styles.title}>SOSmoto</Text>
        <Pressable style={[styles.headerSide, styles.headerSideRight]} onPress={() => switchTab('following')}>
          <Text style={styles.siguiendoBtn}>Siguiendo</Text>
          <Ionicons name="arrow-forward-outline" size={15} color={colors.primary} />
        </Pressable>
      </View>
      <StoriesRow
        own={{
          hasStory: ownHasStory,
          avatarUrl: profile?.avatar_url ?? null,
          previewImageUrl: ownPreviewImageUrl,
          onPress: () =>
            router.push(ownHasStory && profile ? `/(client)/historia-cliente/${profile.id}` : '/(client)/historias'),
        }}
        items={feedItems.map((item) => ({
          ...item,
          onPress: () =>
            router.push(
              item.kind === 'business' ? `/(client)/historia/${item.id}` : `/(client)/historia-cliente/${item.id}`
            ),
        }))}
      />
    </View>
  );

  // Siguiendo: solo historias de negocios seguidos
  const siguiendoScrollHeader = (
    <View>
      <View style={styles.headerRow}>
        <Pressable style={[styles.headerSide, styles.headerSideLeft]} onPress={() => switchTab('all')}>
          <Ionicons name="arrow-back-outline" size={15} color={colors.primary} />
          <Text style={styles.siguiendoBtn}>Para ti</Text>
        </Pressable>
        <Text style={styles.title}>Siguiendo</Text>
        <View style={styles.headerSide} />
      </View>
      <StoriesRow
        own={{
          hasStory: ownHasStory,
          avatarUrl: profile?.avatar_url ?? null,
          previewImageUrl: ownPreviewImageUrl,
          onPress: () =>
            router.push(ownHasStory && profile ? `/(client)/historia-cliente/${profile.id}` : '/(client)/historias'),
        }}
        items={feedItemsFollowing.map((item) => ({
          ...item,
          onPress: () => router.push(`/(client)/historia/${item.id}`),
        }))}
      />
    </View>
  );

  return (
    <View style={styles.flex}>
        {/* Para ti — en reposo en x=0, sale por la izquierda hacia -SCREEN_WIDTH */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: dragX }] }]}
        >
          <HomeFeed
            ref={homeFeedRef}
            role="client"
            city={city}
            feedMode="all"
            clientId={profile?.id}
            onRefresh={load}
            ListHeaderComponent={
              <View>
                {sharedScrollHeader}
                {maintenanceAlerts.length > 0 && (
                  <View style={styles.maintenanceWrap}>
                    {maintenanceAlerts.map((alert) => (
                      <View key={alert.suggestionId} style={styles.maintenanceCard}>
                        <Ionicons
                          name={alert.overdue ? 'warning' : 'time-outline'}
                          size={20}
                          color={alert.overdue ? colors.danger : colors.warning}
                        />
                        <View style={styles.maintenanceCardText}>
                          <Text style={styles.maintenanceCardTitle}>
                            {alert.serviceName} · {alert.vehicleLabel}
                          </Text>
                          <Text style={styles.maintenanceCardMeta}>
                            {alert.overdue
                              ? `Mantenimiento vencido · hace ${Math.abs(alert.kmRemaining).toLocaleString()} km`
                              : `Mantenimiento próximo · faltan ${alert.kmRemaining.toLocaleString()} km`}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.maintenanceCardAction}
                          onPress={() => router.push({ pathname: '/(client)/buscar', params: { service: alert.serviceName } })}
                        >
                          <Ionicons name="search" size={16} color={colors.primary} />
                        </Pressable>
                        <Pressable style={styles.maintenanceCardAction} onPress={() => handleCompleteAlert(alert)}>
                          <Ionicons name="checkmark-done" size={16} color={colors.success} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.createPostWrap}>
                  {profile?.is_limited ? (
                    <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
                  ) : (
                    <CreatePostBox onCreated={() => homeFeedRef.current?.refresh()} />
                  )}
                </View>
                {nearbyNew.length > 0 && (
                  <View style={styles.descubreWrap}>
                    <Text style={styles.sectionTitleInset}>Nuevos cerca de ti</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.descubreRow}>
                      {nearbyNew.map((biz) => (
                        <Pressable
                          key={biz.id}
                          style={styles.descubreCard}
                          onPress={() => router.push(`/(client)/business/${biz.id}`)}
                        >
                          <View style={styles.descubreAvatarWrap}>
                            <View style={styles.descubreAvatar}>
                              {biz.logo_url ? (
                                <Image source={{ uri: biz.logo_url }} style={styles.descubreAvatarImage} />
                              ) : (
                                <Ionicons name="storefront" size={22} color={colors.primary} />
                              )}
                            </View>
                            {biz.is_verified && (
                              <View style={styles.descubreVerifiedDot}>
                                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={1} style={styles.descubreName}>{biz.name}</Text>
                          <Text numberOfLines={1} style={styles.descubreMeta}>
                            {bizTypeLabel[biz.business_type] ?? 'Negocio'}
                            {biz.distance_km !== null ? ` · ${biz.distance_km.toFixed(1)} km` : ''}
                          </Text>
                          {biz.rating_avg > 0 && (
                            <Text style={styles.descubreRating}>★ {biz.rating_avg.toFixed(1)}</Text>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            }
          />
        </Animated.View>

        {/* Siguiendo — en reposo en x=SCREEN_WIDTH (fuera de pantalla derecha), entra a x=0 */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: siguiendoTranslateX }] }]}
        >
          <HomeFeed
            role="client"
            city={city}
            feedMode="following"
            clientId={profile?.id}
            emptyMessage="Los negocios que sigues aún no han publicado nada."
            onRefresh={load}
            ListHeaderComponent={siguiendoScrollHeader}
          />
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 6,
  },
  headerSide: {
    flex: 1,
  },
  headerSideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  headerSideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  siguiendoBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  maintenanceWrap: {
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  maintenanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  maintenanceCardText: {
    flex: 1,
  },
  maintenanceCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  maintenanceCardMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  maintenanceCardAction: {
    padding: 6,
  },
  descubreWrap: {
    marginBottom: 12,
  },
  descubreRow: {
    gap: 10,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  descubreCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  descubreAvatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  descubreAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  descubreAvatarImage: {
    width: 52,
    height: 52,
  },
  descubreVerifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  descubreName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  descubreMeta: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  descubreRating: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  createPostWrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  limitedNotice: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionTitleInset: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
