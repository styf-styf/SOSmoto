import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdGridCard } from '../../components/AdGridCard';
import { BusinessListItem } from '../../components/BusinessListItem';
import { FeedCatalogStrip } from '../../components/FeedCatalogStrip';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { getSearchAdsForBusinessViewer, type AdWithBusiness } from '../../services/ads';
import { getNearestCity, searchBusinesses, type BusinessWithDistance } from '../../services/businesses';
import { searchCatalog, type FeedCatalogItem } from '../../services/catalog';
import type { BusinessType } from '../../types/database';
import { applyFreshnessOrder } from '../../utils/feedOrdering';

// Solo tiendas y marcas -- nunca otros talleres. Un taller no puede seguir
// ni interactuar de ninguna forma con el perfil de otro taller (solo con
// tiendas, relacion B2B), asi que mostrarlos en el buscador del negocio no
// lleva a nada util. Este buscador es exclusivo del taller (la tienda no
// tiene boton de acceso -- ver BusinessProfileView).
const STORE_AND_BRAND_TYPES: BusinessType[] = ['store', 'brand_advertiser'];

const typeFilters: { label: string; value: BusinessType | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Tiendas', value: 'store' },
  { label: 'Marcas', value: 'brand_advertiser' },
];

const ratingFilters = [
  { label: 'Todas', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '4.5+ ★', value: 4.5 },
];

export default function BusinessBuscarScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [query, setQuery] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(undefined);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [only24h, setOnly24h] = useState(false);
  const [results, setResults] = useState<BusinessWithDistance[]>([]);
  const [catalogResults, setCatalogResults] = useState<FeedCatalogItem[]>([]);
  const [featuredAds, setFeaturedAds] = useState<AdWithBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastSeenAdAt = useRef<string | null>(null);
  const didInitialSearchRef = useRef(false);

  const loadAds = useCallback(async () => {
    try {
      const city = await getNearestCity(coords);
      const ads = await getSearchAdsForBusinessViewer(city);
      setFeaturedAds(applyFreshnessOrder(ads, (ad) => ad.created_at, lastSeenAdAt));
    } catch (err) {
      console.error('load search ads error', err);
    }
  }, [coords]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  useFocusEffect(
    useCallback(() => {
      loadAds().catch((err) => console.error('refresh search ads error', err));
    }, [loadAds])
  );

  const search = useCallback(async () => {
    try {
      const [result, catalog] = await Promise.all([
        searchBusinesses({
          query: query || undefined,
          businessType,
          businessTypeIn: businessType ? undefined : STORE_AND_BRAND_TYPES,
          coords,
          minRating,
          only24h: only24h || undefined,
        }),
        query.trim()
          ? searchCatalog({ query, kinds: ['product'], businessTypeIn: STORE_AND_BRAND_TYPES })
          : Promise.resolve([]),
      ]);
      setResults(result);
      setCatalogResults(catalog);
    } catch (err) {
      console.error('search businesses error', err);
    }
  }, [query, businessType, coords, minRating, only24h]);

  useEffect(() => {
    if (!didInitialSearchRef.current) {
      didInitialSearchRef.current = true;
      setLoading(true);
      search().finally(() => setLoading(false));
    } else {
      search().catch((err) => console.error('search background refresh error', err));
    }
  }, [search]);

  const hasActiveFilters = !!query || !!businessType || !!minRating || only24h;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadAds(), search()]);
    } catch (err) {
      console.error('refresh search screen error', err);
    } finally {
      setRefreshing(false);
    }
  }

  if (profile?.is_limited) {
    return (
      <View style={[styles.container, styles.limitedContainer]}>
        <Ionicons name="alert-circle" size={40} color={colors.danger} />
        <Text style={styles.limitedText}>Tu cuenta está limitada y no puedes buscar negocios por ahora.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filterRow}>
        {typeFilters.map((filter) => (
          <Pressable
            key={filter.label}
            onPress={() => setBusinessType(filter.value)}
            style={[styles.filterChip, businessType === filter.value && styles.filterChipSelected]}
          >
            <Text style={[styles.filterChipText, businessType === filter.value && styles.filterChipTextSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
        {ratingFilters.map((filter) => (
          <Pressable
            key={filter.label}
            onPress={() => setMinRating(filter.value)}
            style={[styles.filterChip, minRating === filter.value && styles.filterChipSelected]}
          >
            <Text style={[styles.filterChipText, minRating === filter.value && styles.filterChipTextSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setOnly24h((prev) => !prev)}
          style={[styles.filterChip, only24h && styles.filterChipSelected]}
        >
          <Text style={[styles.filterChipText, only24h && styles.filterChipTextSelected]}>24/7</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.results}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {featuredAds.length > 0 && (
            <View style={styles.adsGrid}>
              {featuredAds.map((ad) => (
                <AdGridCard key={ad.id} ad={ad} detailHref={`/(business)/anuncio/${ad.id}`} />
              ))}
            </View>
          )}
          <Text style={styles.sectionTitle}>{hasActiveFilters ? 'Resultados' : 'Descubre cerca de ti'}</Text>
          {results.length === 0 ? (
            <Text style={styles.placeholder}>No encontramos negocios con esos filtros.</Text>
          ) : (
            results.map((business) => (
              <BusinessListItem
                key={business.id}
                business={business}
                distanceKm={business.distance_km}
                hrefPrefix="/(business)"
              />
            ))
          )}

          {query.trim().length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.catalogSectionTitle]}>Productos</Text>
              {catalogResults.length === 0 ? (
                <Text style={styles.placeholder}>No encontramos productos con ese nombre.</Text>
              ) : (
                <FeedCatalogStrip items={[]} listItems={catalogResults} role="business" />
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  searchInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  limitedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  limitedText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  catalogSectionTitle: {
    marginTop: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: colors.primary,
  },
  loading: {
    marginTop: 40,
  },
  results: {
    paddingTop: 4,
  },
  adsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
