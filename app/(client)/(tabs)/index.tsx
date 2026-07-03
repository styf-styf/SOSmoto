import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getNewNearbyBusinesses, getNearestCity, type BusinessWithDistance } from '../../../services/businesses';
import { getHomeMaintenanceAlerts, markCompleted, type MaintenanceAlert } from '../../../services/maintenance';
import {
  getSeenStoryIds,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  type StoryFeedItem,
} from '../../../services/stories';
import { CreatePostBox } from '../../../components/CreatePostBox';
import { HomeFeed, type HomeFeedHandle } from '../../../components/HomeFeed';
import { StoriesRow } from '../../../components/StoriesRow';
import { clearLimitedMark, markLimited, wasPreviouslyLimited } from '../../../utils/accountLimit';

const bizTypeLabel: Record<string, string> = { workshop: 'Taller', store: 'Tienda' };

export default function ClientHomeScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [city, setCity] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownHasStory, setOwnHasStory] = useState(false);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [nearbyNew, setNearbyNew] = useState<BusinessWithDistance[]>([]);
  const [feedMode, setFeedMode] = useState<'all' | 'following'>('all');
  const [loading, setLoading] = useState(true);
  const homeFeedRef = useRef<HomeFeedHandle>(null);
  const limitCheckedRef = useRef(false);

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

      const [businessStoriesGlobal, clientStoriesGlobal, newNearby] = await Promise.all([
        getVisibleBusinessStoriesGlobal(),
        getVisibleClientStories(),
        getNewNearbyBusinesses(coords),
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
      setOwnHasStory(!!ownClientStory);
      setOwnPreviewImageUrl(ownClientStory?.image_url ?? null);
    } catch (err) {
      console.error('home load error', err);
    }
  }, [profile, coords]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh client home error', err));
    }, [load])
  );

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

  return (
    <HomeFeed
      ref={homeFeedRef}
      role="client"
      city={city}
      feedMode={feedMode}
      clientId={profile?.id}
      emptyMessage={
        feedMode === 'following'
          ? 'Los negocios que sigues aún no han publicado nada. Cambia a "Para ti" para ver todo el contenido.'
          : 'Todavía no hay publicaciones.'
      }
      onRefresh={load}
      ListHeaderComponent={
        <View>
          <View style={styles.headerWrap}>
            <Text style={styles.title}>SOSmoto</Text>
            <Text style={styles.sectionTitle}>Historias</Text>
          </View>
          <View style={styles.storiesWrap}>
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

          {/* Feed mode chips */}
          <View style={styles.chipsWrap}>
            <Pressable
              style={[styles.chip, feedMode === 'all' && styles.chipActive]}
              onPress={() => setFeedMode('all')}
            >
              <Text style={[styles.chipText, feedMode === 'all' && styles.chipTextActive]}>Para ti</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, feedMode === 'following' && styles.chipActive]}
              onPress={() => setFeedMode('following')}
            >
              <Text style={[styles.chipText, feedMode === 'following' && styles.chipTextActive]}>Siguiendo</Text>
            </Pressable>
          </View>

          {/* Maintenance alerts */}
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
                    onPress={() =>
                      router.push({ pathname: '/(client)/buscar', params: { service: alert.serviceName } })
                    }
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

          {/* Descubre — only in "Para ti" mode */}
          {feedMode === 'all' && nearbyNew.length > 0 && (
            <View style={styles.descubreWrap}>
              <Text style={styles.sectionTitle}>Nuevos cerca de ti</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.descubreRow}>
                {nearbyNew.map((biz) => (
                  <Pressable
                    key={biz.id}
                    style={styles.descubreCard}
                    onPress={() => router.push(`/(client)/business/${biz.id}`)}
                  >
                    <View style={styles.descubreAvatar}>
                      {biz.logo_url ? (
                        <Image source={{ uri: biz.logo_url }} style={styles.descubreAvatarImage} />
                      ) : (
                        <Ionicons name="storefront" size={22} color={colors.primary} />
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

          {/* Create post — only in "Para ti" mode */}
          {feedMode === 'all' && (
            <View style={styles.createPostWrap}>
              {profile?.is_limited ? (
                <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
              ) : (
                <CreatePostBox onCreated={() => homeFeedRef.current?.refresh()} />
              )}
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 36,
  },
  storiesWrap: {
    paddingBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  maintenanceWrap: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  descubreWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  descubreRow: {
    gap: 10,
    paddingBottom: 4,
  },
  descubreCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  descubreAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  descubreAvatarImage: {
    width: 52,
    height: 52,
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
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
});
