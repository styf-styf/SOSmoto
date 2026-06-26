import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BusinessListItem } from '../../components/BusinessListItem';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import { searchBusinesses, type BusinessWithDistance } from '../../services/businesses';
import type { BusinessType } from '../../types/database';

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
  const { coords } = useLocation();

  const [query, setQuery] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(params.service);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [only24h, setOnly24h] = useState(false);
  const [results, setResults] = useState<BusinessWithDistance[]>([]);
  const [loading, setLoading] = useState(true);

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
        <ScrollView contentContainerStyle={styles.results}>
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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
