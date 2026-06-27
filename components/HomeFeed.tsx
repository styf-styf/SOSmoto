import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { getFeedAds } from '../services/ads';
import { getFeedCatalogItems, type FeedCatalogItem } from '../services/catalog';
import { getPublicFeedPage, type PostWithAuthor } from '../services/posts';
import type { Ad } from '../types/database';
import { AdBanner } from './AdBanner';
import { FeedCatalogCard } from './FeedCatalogCard';
import { PostCard } from './PostCard';

const PAGE_SIZE = 10;
const INSERT_EVERY = 5;

type FeedRow =
  | { key: string; kind: 'post'; post: PostWithAuthor }
  | { key: string; kind: 'catalog'; item: FeedCatalogItem }
  | { key: string; kind: 'ad'; ad: Ad };

// Inserta una tarjeta de catálogo o de publicidad cada INSERT_EVERY
// publicaciones, alternando el tipo, igual al patrón de feeds tipo
// Instagram/Facebook. Se recalcula completo a partir de `posts` en vez de
// llevar un contador con estado para que la paginación nunca lo desordene.
function buildRows(posts: PostWithAuthor[], catalogPool: FeedCatalogItem[], adPool: Ad[]): FeedRow[] {
  const rows: FeedRow[] = [];
  let insertedCount = 0;
  posts.forEach((post, index) => {
    rows.push({ key: `post-${post.id}`, kind: 'post', post });
    if ((index + 1) % INSERT_EVERY === 0) {
      const useAd = insertedCount % 2 === 1;
      if (useAd && adPool.length > 0) {
        const ad = adPool[Math.floor(insertedCount / 2) % adPool.length];
        rows.push({ key: `ad-${ad.id}-${insertedCount}`, kind: 'ad', ad });
        insertedCount++;
      } else if (catalogPool.length > 0) {
        const item = catalogPool[Math.floor(insertedCount / 2) % catalogPool.length];
        rows.push({ key: `catalog-${item.kind}-${item.id}-${insertedCount}`, kind: 'catalog', item });
        insertedCount++;
      }
    }
  });
  return rows;
}

export function HomeFeed({
  role,
  city,
  ListHeaderComponent,
}: {
  role: 'client' | 'business';
  city: string | null;
  ListHeaderComponent?: ReactElement;
}) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [catalogPool, setCatalogPool] = useState<FeedCatalogItem[]>([]);
  const [adPool, setAdPool] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadInitial = useCallback(async () => {
    const [postsPage, catalog, ads] = await Promise.all([
      getPublicFeedPage({ limit: PAGE_SIZE }),
      getFeedCatalogItems(),
      getFeedAds(city),
    ]);
    setPosts(postsPage);
    setCatalogPool(catalog);
    setAdPool(ads);
    setHasMore(postsPage.length === PAGE_SIZE);
  }, [city]);

  useEffect(() => {
    setLoading(true);
    loadInitial()
      .catch((err) => console.error('home feed load error', err))
      .finally(() => setLoading(false));
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadInitial();
    } catch (err) {
      console.error('home feed refresh error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const last = posts[posts.length - 1];
      const nextPage = await getPublicFeedPage({ limit: PAGE_SIZE, before: last.created_at });
      setPosts((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (err) {
      console.error('home feed load more error', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const rows = useMemo(() => buildRows(posts, catalogPool, adPool), [posts, catalogPool, adPool]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => {
        if (item.kind === 'post') {
          return <PostCard post={item.post} detailHref={`/(${role})/publicacion/${item.post.id}`} />;
        }
        if (item.kind === 'catalog') {
          return <FeedCatalogCard item={item.item} />;
        }
        return <AdBanner ad={item.ad} />;
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<Text style={styles.placeholder}>Todavía no hay publicaciones.</Text>}
      contentContainerStyle={styles.container}
      onEndReachedThreshold={0.4}
      onEndReached={handleLoadMore}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} /> : null}
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
  container: {
    padding: 20,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLoader: {
    marginTop: 12,
  },
});
