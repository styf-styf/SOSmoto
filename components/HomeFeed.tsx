import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { getHomeAds, type AdWithBusiness } from '../services/ads';
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

export interface HomeFeedHandle {
  refresh: () => Promise<void>;
  // Al volver a Inicio desde otra pestaña -- el FlatList sigue montado
  // (lazy: false) así que conserva el scroll donde quedó; esto lo fuerza de
  // vuelta arriba sin disparar un refresh aparte (el foco ya refresca solo).
  scrollToTop: () => void;
  // Botón "Inicio" de la tab bar tocado estando YA en Inicio: si el feed ya
  // está arriba del todo, refresca; si no, primero lo lleva arriba (sin
  // refrescar todavía -- un segundo toque ya estando arriba sí refresca,
  // mismo patrón que Instagram/Twitter).
  scrollToTopOrRefresh: () => void;
}

// Umbral chico en vez de 0 exacto -- con inercia o un scroll casi
// imperceptible, contentOffset.y puede quedar en 1-2px aunque el usuario ya
// esté "arriba" a simple vista.
const TOP_SCROLL_THRESHOLD = 8;

export const HomeFeed = forwardRef<
  HomeFeedHandle,
  {
    role: 'client' | 'business';
    city: string | null;
    // Ubicación real del que mira el feed -- se usa solo para elegibilidad de
    // anuncios con alcance "Radio" (ver services/ads.ts getEligibleAds). Nula
    // mientras se resuelve el permiso/GPS; los anuncios nacional/ciudad no la
    // necesitan.
    coords?: { latitude: number; longitude: number } | null;
    feedMode?: 'all' | 'following';
    clientId?: string;
    emptyMessage?: string;
    ListHeaderComponent?: ReactElement;
    // El pantalla padre carga las Historias por separado (fuera de este feed
    // de posts/catálogo/anuncios) -- sin esto, el pull-to-refresh solo
    // refrescaba lo interno y las historias nuevas solo aparecían al cerrar y
    // reabrir la app.
    onRefresh?: () => Promise<void> | void;
    // Negocio del propio usuario (dueño o empleado) -- se pasa a cada
    // PostCard para que reconozca sus propias publicaciones aunque quien
    // mira sea un mecánico, no el dueño (ver PostCard.tsx).
    viewerBusinessId?: string;
  }
>(function HomeFeed(
  { role, city, coords = null, feedMode = 'all', clientId, emptyMessage, ListHeaderComponent, onRefresh, viewerBusinessId },
  ref
) {
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
  const didInitialLoadRef = useRef(false);
  const flatListRef = useRef<FlatList<FeedRow>>(null);
  const scrollOffsetRef = useRef(0);

  const loadInitial = useCallback(async () => {
    const [postsPage, homeAds] = await Promise.all([
      feedMode === 'following' && clientId
        ? getFollowingFeedPage(clientId, { limit: PAGE_SIZE })
        : getPublicFeedPage({ limit: PAGE_SIZE }),
      getHomeAds(city, coords),
    ]);

    // getFeedCatalogPool depende de homeAds.linkedCatalogIds (para no
    // mostrar la tarjeta orgánica de un producto/servicio que ya tiene su
    // propio anuncio activo en el mismo pool) -- por eso va después, no en
    // el mismo Promise.all.
    const catalog = await getFeedCatalogPool(30, { excludeIds: homeAds.linkedCatalogIds });

    setPosts(postsPage);
    // Los anuncios activos se mezclan como tarjetas más del carrusel de
    // catálogo (con su chip "Anuncio", ver FeedCatalogStrip) -- aparte del
    // banner de publicidad de siempre (adPool más abajo, sin cambios). Los
    // dos ya vienen repartidos sin superposición desde getHomeAds.
    const orderedCatalog = applyFreshnessOrder([...catalog, ...homeAds.carouselItems], (item) => item.createdAt, lastSeenCatalogAt);
    setCatalogPoolPhoto(orderedCatalog.filter((item) => item.photoUrl));
    setCatalogPoolNoPhoto(orderedCatalog.filter((item) => !item.photoUrl));
    setAdPool(applyFreshnessOrder(homeAds.bannerAds, (item) => item.created_at, lastSeenAdAt));
    setHasMore(postsPage.length === PAGE_SIZE);
  }, [city, coords, feedMode, clientId]);

  // loadInitial depende de city/clientId, que llegan como prop desde la
  // pantalla padre y arrancan en null/undefined hasta que se resuelven
  // ubicación/perfil -- eso cambia la identidad de loadInitial un instante
  // después del mount. Antes esto vaciaba `posts` y mostraba el spinner de
  // nuevo (la pantalla "se recargaba"). Ahora solo se hace ese reset la
  // primera vez; las veces siguientes se refresca en silencio sobre el
  // feed que ya está en pantalla.
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setPosts([]);
      setHasMore(true);
      setLoading(true);
      loadInitial()
        .catch((err) => console.error('home feed load error', err))
        .finally(() => setLoading(false));
    } else {
      loadInitial().catch((err) => console.error('home feed background refresh error', err));
    }
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
  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
    scrollToTop: () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    scrollToTopOrRefresh: () => {
      if (scrollOffsetRef.current > TOP_SCROLL_THRESHOLD) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else {
        handleRefresh();
      }
    },
  }));

  async function handleLoadMore() {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const last = posts[posts.length - 1];
      const nextPage =
        feedMode === 'following' && clientId
          ? await getFollowingFeedPage(clientId, {
              limit: PAGE_SIZE,
              before: { createdAt: last.created_at, id: last.id },
            })
          : await getPublicFeedPage({
              limit: PAGE_SIZE,
              before: { createdAt: last.created_at, id: last.id },
            });
      setPosts((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (err) {
      console.error('home feed load more error', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const rows = useMemo(
    () => buildRows(posts, catalogPoolPhoto, catalogPoolNoPhoto, adPool),
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
      ref={flatListRef}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => {
        if (item.kind === 'post') {
          return (
            <PostCard
              post={item.post}
              detailHref={`/(${role})/publicacion/${item.post.id}`}
              userRole={role}
              viewerBusinessId={viewerBusinessId}
            />
          );
        }
        if (item.kind === 'catalog') {
          return <FeedCatalogStrip items={item.items} listItems={item.listItems} role={role} />;
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
