import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { getNearestCity } from '../../services/businesses';
import {
  getSeenStoryIds,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  type StoryFeedItem,
} from '../../services/stories';
import { HomeFeed } from '../../components/HomeFeed';
import { StoriesRow } from '../../components/StoriesRow';

export default function ClientHomeScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [city, setCity] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownHasStory, setOwnHasStory] = useState(false);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setCity(await getNearestCity(coords));

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <HomeFeed
      role="client"
      city={city}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Inicio</Text>

          <Text style={styles.sectionTitle}>Historias</Text>
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
});
