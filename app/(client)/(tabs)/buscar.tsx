import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdGridCard } from '../../../components/AdGridCard';
import { BusinessListItem } from '../../../components/BusinessListItem';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { getSearchAds, type AdWithBusiness } from '../../../services/ads';
import { getNearestCity, searchBusinesses, type BusinessWithDistance } from '../../../services/businesses';
import type { BusinessType } from '../../../types/database';
import { applyFreshnessOrder } from '../../../utils/feedOrdering';

const typeFilters: { label: string; value: BusinessType | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Talleres', value: 'workshop' },
  { label: 'Tiendas', value: 'store' },
];

const ratingFilters = [
  { label: 'Todas', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '4.5+ ★', value: 4.5 },
];

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ service?: string }>();
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [query, setQuery] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(params.service);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [only24h, setOnly24h] = useState(false);
  const [results, setResults] = useState<BusinessWithDistance[]>([]);
  const [featuredAds, setFeaturedAds] = useState<AdWithBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastSeenAdAt = useRef<string | null>(null);

  const loadAds = useCallback(async () => {
    try {
      const city = await getNearestCity(coords);
      const ads = await getSearchAds(city);
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
      const result = await searchBusinesses({
        query: query || undefined,
        businessType,
        serviceName: serviceFilter,
        coords,
        minRating,
        only24h: only24h || undefined,
      });
      setResults(result);
    } catch (err) {
      console.error('search businesses error', err);
    }
  }, [query, businessType, serviceFilter, coords, minRating, only24h]);

  useEffect(() => {
    setLoading(true);
    search().finally(() => setLoading(false));
  }, [search]);

  const hasActiveFilters = !!query || !!businessType || !!serviceFilter || !!minRating || only24h;

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
        <Text style={styles.limitedText}>
          Tu cuenta está limitada y no puedes buscar talleres por ahora. Si necesitas ayuda en carretera, usa el botón
          SOS.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buscar talleres</Text>

      <TextField
        label="Buscar"
        placeholder="Nombre, dirección o ciudad"
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
            <Text
              style={[styles.filterChipText, businessType === filter.value && styles.filterChipTextSelected]}
            >
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

      {serviceFilter && (
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>Servicio: {serviceFilter}</Text>
          <Pressable onPress={() => setServiceFilter(undefined)}>
            <Ionicons name="close-circle" size={18} color={colors.primary} />
          </Pressable>
        </View>
      )}

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
                <AdGridCard key={ad.id} ad={ad} detailHref={`/(client)/anuncio/${ad.id}`} />
              ))}
            </View>
          )}
          <Text style={styles.sectionTitle}>{hasActiveFilters ? 'Resultados' : 'Descubre cerca de ti'}</Text>
          {results.length === 0 ? (
            <Text style={styles.placeholder}>No encontramos talleres con esos filtros.</Text>
          ) : (
            results.map((business) => (
              <BusinessListItem key={business.id} business={business} distanceKm={business.distance_km} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
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
  serviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  serviceBadgeText: {
    fontSize: 13,
    color: colors.text,
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
