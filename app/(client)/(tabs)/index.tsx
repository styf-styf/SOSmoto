import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getNearestCity } from '../../../services/businesses';
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

export default function ClientHomeScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [city, setCity] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownHasStory, setOwnHasStory] = useState(false);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
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

      const [businessStoriesGlobal, clientStoriesGlobal] = await Promise.all([
        getVisibleBusinessStoriesGlobal(),
        getVisibleClientStories(),
      ]);
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
      await markCompleted(alert.suggestionId);
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
      onRefresh={load}
      ListHeaderComponent={
        <View>
          <View style={styles.headerWrap}>
            <Text style={styles.title}>SOSmoto</Text>
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
                        {alert.overdue ? 'Mantenimiento vencido' : 'Mantenimiento próximo'}
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
          <View style={styles.createPostWrap}>
            {profile?.is_limited ? (
              <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
            ) : (
              <CreatePostBox onCreated={() => homeFeedRef.current?.refresh()} />
            )}
          </View>
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
    paddingBottom: 16,
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
  maintenanceWrap: {
    gap: 8,
    marginBottom: 16,
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
