import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { getFeedAds, type AdWithBusiness } from '../services/ads';
import { getFeedCatalogPool, type FeedCatalogItem } from '../services/catalog';
import { getFollowingFeedPage, getPublicFeedPage, type PostWithAuthor } from '../services/posts';
import { applyFreshnessOrder } from '../utils/feedOrdering';
import { AdBanner } from './AdBanner';
import { FeedCatalogStrip } from './FeedCatalogStrip';
import { PostCard } from './PostCard';

const PAGE_SIZE = 10;
const AD_EVERY = 5;
const CATALOG_EVERY = 5;
const CATALOG_OFFSET = 3;
const CATALOG_STRIP_SIZE = 6;
const CATALOG_LIST_SIZE = 3;

type FeedRow =
  | { key: string; kind: 'post'; post: PostWithAuthor }
  | { key: string; kind: 'catalog'; items: FeedCatalogItem[]; listItems: FeedCatalogItem[] }
  | { key: string; kind: 'ad'; ad: AdWithBusiness };

// Toma una "ventana" de `size` items del pool, distinta en cada punto de
// inserción (windowIndex avanza), con wraparound -- así cada tira de catálogo
// en el feed muestra una mezcla distinta en vez de repetir siempre los mismos
// productos/servicios. Se usa tanto para el carrusel de fotos (size 6) como
// para la lista de items sin foto (size 3), cada uno con su propio pool.
function pickWindow<T>(pool: T[], windowIndex: number, size: number): T[] {
  if (pool.length === 0) return [];
  const count = Math.min(size, pool.length);
  const start = (windowIndex * size) % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

// Anuncios y catálogo tienen cada uno su propio ritmo fijo cada 5
// publicaciones, desfasados entre sí (catálogo en la 3, anuncio en la 5, 8,
// 10, 13, 15...) para que ninguno le quite frecuencia al otro. Se recalcula
// completo a partir de `posts` en vez de llevar un contador con estado para
// que la paginación nunca lo desordene.
function buildRows(
  posts: PostWithAuthor[],
  catalogPoolPhoto: FeedCatalogItem[],
  catalogPoolNoPhoto: FeedCatalogItem[],
  adPool: AdWithBusiness[]
): FeedRow[] {
  const rows: FeedRow[] = [];
  let adIndex = 0;
  let catalogWindowIndex = 0;
  posts.forEach((post, index) => {
    const position = index + 1;
    rows.push({ key: `post-${post.id}`, kind: 'post', post });

    if (position % CATALOG_EVERY === CATALOG_OFFSET && (catalogPoolPhoto.length > 0 || catalogPoolNoPhoto.length > 0)) {
      const items = pickWindow(catalogPoolPhoto, catalogWindowIndex, CATALOG_STRIP_SIZE);
      const listItems = pickWindow(catalogPoolNoPhoto, catalogWindowIndex, CATALOG_LIST_SIZE);
      rows.push({ key: `catalog-${catalogWindowIndex}`, kind: 'catalog', items, listItems });
      catalogWindowIndex++;
    }

    if (position % AD_EVERY === 0 && adPool.length > 0) {
      const ad = adPool[adIndex % adPool.length];
      rows.push({ key: `ad-${ad.id}-${position}`, kind: 'ad', ad });
      adIndex++;
    }
  });
  return rows;
}

type DecoratedRow = FeedRow & {
  gray: boolean;
  showTopShadow: boolean;
  showBottomShadow: boolean;
  topFadeFromHeader?: boolean;
};

function isGrayPost(row: FeedRow | null): boolean {
  return !!row && row.kind === 'post' && row.post.photos.length === 0;
}

// Catálogo y posts sin imagen comparten la misma sensación de "fondo": si un
// carrusel de catálogo queda pegado (arriba o abajo) a un post sin imagen, se
// pinta gris también y se apaga la sombra del lado compartido, para que se
// vean como un solo bloque continuo en vez de dos tarjetas hundidas
// separadas. Los anuncios quedan fuera de este merge a propósito (siempre
// "elevados").
function decorateRows(rows: FeedRow[]): DecoratedRow[] {
  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const next = i < rows.length - 1 ? rows[i + 1] : null;

    if (row.kind === 'post') {
      const gray = row.post.photos.length === 0;
      if (!gray) return { ...row, gray: false, showTopShadow: true, showBottomShadow: true };
      const isFirst = i === 0;
      const prevGray = isGrayPost(prev) || prev?.kind === 'catalog';
      const nextGray = isGrayPost(next) || next?.kind === 'catalog';
      // i === 0: no hay nada arriba en el feed salvo el header (blanco) -- en
      // vez de la sombra normal (o nada), se funde de blanco a gris para que
      // el cambio de fondo se vea como una transición, no como un escalón.
      return {
        ...row,
        gray: true,
        showTopShadow: !prevGray && !isFirst,
        showBottomShadow: !nextGray,
        topFadeFromHeader: isFirst,
      };
    }

    if (row.kind === 'catalog') {
      const prevGray = isGrayPost(prev);
      const nextGray = isGrayPost(next);
      const gray = prevGray || nextGray;
      return { ...row, gray, showTopShadow: !prevGray, showBottomShadow: !nextGray };
    }

    return { ...row, gray: false, showTopShadow: true, showBottomShadow: true };
  });
}

export interface HomeFeedHandle {
  refresh: () => Promise<void>;
}

export const HomeFeed = forwardRef<
  HomeFeedHandle,
  {
    role: 'client' | 'business';
    city: string | null;
    feedMode?: 'all' | 'following';
    clientId?: string;
    emptyMessage?: string;
    ListHeaderComponent?: ReactElement;
    // El pantalla padre carga las Historias por separado (fuera de este feed
    // de posts/catálogo/anuncios) -- sin esto, el pull-to-refresh solo
    // refrescaba lo interno y las historias nuevas solo aparecían al cerrar y
    // reabrir la app.
    onRefresh?: () => Promise<void> | void;
  }
>(function HomeFeed({ role, city, feedMode = 'all', clientId, emptyMessage, ListHeaderComponent, onRefresh }, ref) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [catalogPoolPhoto, setCatalogPoolPhoto] = useState<FeedCatalogItem[]>([]);
  const [catalogPoolNoPhoto, setCatalogPoolNoPhoto] = useState<FeedCatalogItem[]>([]);
  const [adPool, setAdPool] = useState<AdWithBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastSeenCatalogAt = useRef<string | null>(null);
  const lastSeenAdAt = useRef<string | null>(null);

  const loadInitial = useCallback(async () => {
    const postsPage =
      feedMode === 'following' && clientId
        ? await getFollowingFeedPage(clientId, { limit: PAGE_SIZE })
        : await getPublicFeedPage({ limit: PAGE_SIZE });

    const [catalog, ads] = await Promise.all([getFeedCatalogPool(), getFeedAds(city)]);

    setPosts(postsPage);
    const orderedCatalog = applyFreshnessOrder(catalog, (item) => item.createdAt, lastSeenCatalogAt);
    setCatalogPoolPhoto(orderedCatalog.filter((item) => item.photoUrl));
    setCatalogPoolNoPhoto(orderedCatalog.filter((item) => !item.photoUrl));
    setAdPool(applyFreshnessOrder(ads, (item) => item.created_at, lastSeenAdAt));
    setHasMore(postsPage.length === PAGE_SIZE);
  }, [city, feedMode, clientId]);

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    setLoading(true);
    loadInitial()
      .catch((err) => console.error('home feed load error', err))
      .finally(() => setLoading(false));
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadInitial(), onRefresh?.()]);
    } catch (err) {
      console.error('home feed refresh error', err);
    } finally {
      setRefreshing(false);
    }
  }

  // Permite que un componente externo (ej. el composer de "Crear
  // publicación" sobre el feed) fuerce un refresh tras publicar, sin que
  // HomeFeed deje de ser dueño de su propio estado de posts/catálogo/ads.
  useImperativeHandle(ref, () => ({ refresh: handleRefresh }));

  async function handleLoadMore() {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const last = posts[posts.length - 1];
      const nextPage =
        feedMode === 'following' && clientId
          ? await getFollowingFeedPage(clientId, { limit: PAGE_SIZE, before: { createdAt: last.created_at, id: last.id } })
          : await getPublicFeedPage({ limit: PAGE_SIZE, before: { createdAt: last.created_at, id: last.id } });
      setPosts((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (err) {
      console.error('home feed load more error', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const rows = useMemo(
    () => decorateRows(buildRows(posts, catalogPoolPhoto, catalogPoolNoPhoto, adPool)),
    [posts, catalogPoolPhoto, catalogPoolNoPhoto, adPool]
  );

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
          return (
            <PostCard
              post={item.post}
              detailHref={`/(${role})/publicacion/${item.post.id}`}
              userRole={role}
              showTopShadow={item.showTopShadow}
              showBottomShadow={item.showBottomShadow}
              topFadeFromHeader={item.topFadeFromHeader}
            />
          );
        }
        if (item.kind === 'catalog') {
          return (
            <FeedCatalogStrip
              items={item.items}
              listItems={item.listItems}
              role={role}
              grayBackground={item.gray}
              showTopShadow={item.showTopShadow}
              showBottomShadow={item.showBottomShadow}
            />
          );
        }
        return <AdBanner ad={item.ad} detailHref={`/(${role})/anuncio/${item.ad.id}`} />;
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <Text style={styles.placeholder}>
          {emptyMessage ?? 'Todavía no hay publicaciones.'}
        </Text>
      }
      contentContainerStyle={styles.container}
      onEndReachedThreshold={0.4}
      onEndReached={handleLoadMore}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} /> : null}
    />
  );
});

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 20,
  },
  footerLoader: {
    marginTop: 12,
  },
});
