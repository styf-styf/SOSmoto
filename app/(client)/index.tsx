import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { getHomeAds } from '../../services/ads';
import { getFollowedBusinesses, getNearbyBusinesses, type BusinessWithDistance } from '../../services/businesses';
import {
  getProductsForBusinesses,
  getServicesForBusinesses,
  type ProductWithBusiness,
  type ServiceWithBusiness,
} from '../../services/catalog';
import { getSeenStoryIds, getVisibleClientStories, getVisibleStoriesForBusinesses } from '../../services/stories';
import { AdBanner } from '../../components/AdBanner';
import { BusinessListItem } from '../../components/BusinessListItem';
import { CatalogCard } from '../../components/CatalogCard';
import { ClientStoriesBar, type ClientStoryAuthorItem } from '../../components/ClientStoriesBar';
import { StoriesBar, type StoryBusinessItem } from '../../components/StoriesBar';
import type { Ad, Business } from '../../types/database';

export default function ClientHomeScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [following, setFollowing] = useState<Business[]>([]);
  const [nearby, setNearby] = useState<BusinessWithDistance[]>([]);
  const [services, setServices] = useState<ServiceWithBusiness[]>([]);
  const [products, setProducts] = useState<ProductWithBusiness[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [storyItems, setStoryItems] = useState<StoryBusinessItem[]>([]);
  const [clientStoryItems, setClientStoryItems] = useState<ClientStoryAuthorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [followingResult, nearbyResult] = await Promise.all([
        profile ? getFollowedBusinesses(profile.id) : Promise.resolve([]),
        getNearbyBusinesses(coords),
      ]);
      setFollowing(followingResult);
      setNearby(nearbyResult);
      setAds(await getHomeAds(nearbyResult[0]?.city ?? null));

      const businessIds = Array.from(
        new Set([...followingResult.map((b) => b.id), ...nearbyResult.map((b) => b.id)])
      );
      const [servicesResult, productsResult] = await Promise.all([
        getServicesForBusinesses(businessIds),
        getProductsForBusinesses(businessIds),
      ]);
      setServices(servicesResult);
      setProducts(productsResult);

      const visibleStories = await getVisibleStoriesForBusinesses(businessIds);
      const businessIdsWithStory = new Set(visibleStories.map((s) => s.business_id));
      const seenIds = profile
        ? await getSeenStoryIds(profile.id, visibleStories.map((s) => s.id))
        : new Set<string>();

      const businessesById = new Map<string, Business>(
        [...followingResult, ...nearbyResult].map((b) => [b.id, b])
      );
      const orderedIds = [
        ...followingResult.map((b) => b.id),
        ...nearbyResult.map((b) => b.id).filter((id) => !followingResult.some((b) => b.id === id)),
      ];
      const items: StoryBusinessItem[] = orderedIds
        .filter((id) => businessIdsWithStory.has(id))
        .map((id) => ({
          business: businessesById.get(id)!,
          hasUnseen: visibleStories.some((s) => s.business_id === id && !seenIds.has(s.id)),
        }));
      setStoryItems(items);

      const visibleClientStories = await getVisibleClientStories();
      const otherClientStories = visibleClientStories.filter((s) => s.client_id !== profile?.id);
      const ownClientStory = visibleClientStories.find((s) => s.client_id === profile?.id);
      const seenClientStoryIds = profile
        ? await getSeenStoryIds(profile.id, otherClientStories.map((s) => s.id))
        : new Set<string>();
      const clientStoryAuthorIds = Array.from(new Set(otherClientStories.map((s) => s.client_id as string)));
      const clientStoryItemsResult: ClientStoryAuthorItem[] = clientStoryAuthorIds
        .map((id) => {
          const story = otherClientStories.find((s) => s.client_id === id);
          if (!story?.users) return null;
          return {
            client: story.users,
            hasUnseen: otherClientStories.some((s) => s.client_id === id && !seenClientStoryIds.has(s.id)),
          };
        })
        .filter((item): item is ClientStoryAuthorItem => item !== null);
      if (ownClientStory?.users) {
        clientStoryItemsResult.unshift({ client: ownClientStory.users, hasUnseen: false, isOwn: true });
      }
      setClientStoryItems(clientStoryItemsResult);
    } catch (err) {
      console.error('home load error', err);
    }
  }, [profile, coords]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Inicio</Text>

      <StoriesBar items={storyItems} />

      {clientStoryItems.length > 0 && (
        <Section title="Comunidad">
          <ClientStoriesBar items={clientStoryItems} />
        </Section>
      )}

      {ads.map((ad) => (
        <AdBanner key={ad.id} ad={ad} />
      ))}

      <Section title="Servicios destacados">
        {services.length === 0 ? (
          <Text style={styles.placeholder}>
            Aún no hay servicios de talleres que sigues o cercanos a ti.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {services.map((service) => (
              <CatalogCard
                key={service.id}
                itemId={service.id}
                itemType="service"
                businessName={service.business_name}
                name={service.name}
                referencePrice={service.reference_price}
                photoUrl={service.photos[0]}
              />
            ))}
          </ScrollView>
        )}
      </Section>

      <Section title="Productos destacados">
        {products.length === 0 ? (
          <Text style={styles.placeholder}>
            Aún no hay productos de negocios que sigues o cercanos a ti.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {products.map((product) => (
              <CatalogCard
                key={product.id}
                itemId={product.id}
                itemType="product"
                businessName={product.business_name}
                name={product.name}
                referencePrice={product.reference_price}
                meta={`Stock: ${product.stock}`}
                photoUrl={product.photos[0]}
              />
            ))}
          </ScrollView>
        )}
      </Section>

      <Section title="Siguiendo">
        {following.length === 0 ? (
          <Text style={styles.placeholder}>
            Aún no sigues a ningún negocio. Explora "Buscar" y sigue talleres para ver sus novedades aquí.
          </Text>
        ) : (
          following.map((business) => <BusinessListItem key={business.id} business={business} />)
        )}
      </Section>

      <Section title="Descubre cerca de ti">
        {nearby.length === 0 ? (
          <Text style={styles.placeholder}>Todavía no hay talleres registrados cerca de ti.</Text>
        ) : (
          nearby.map((business) => (
            <BusinessListItem key={business.id} business={business} distanceKm={business.distance_km} />
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
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
});
