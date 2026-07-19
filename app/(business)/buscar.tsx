import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BusinessDiscoverCard } from '../../components/BusinessDiscoverCard';
import { FeedCatalogStrip } from '../../components/FeedCatalogStrip';
import { InfoButton, InfoExample, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { searchActiveAds } from '../../services/ads';
import {
  B2B_ALLOWED_SELLER_TYPES,
  getMyWorkBusiness,
  getNearestCity,
  searchBusinesses,
  type BusinessWithDistance,
} from '../../services/businesses';
import { searchCatalog, type FeedCatalogItem } from '../../services/catalog';
import type { BusinessType } from '../../types/database';

// Este buscador es exclusivo de taller/tienda (la marca no tiene boton de
// acceso -- no le compra a nadie, ver BusinessProfileView). Regla de quien
// ve a quien: B2B_ALLOWED_SELLER_TYPES (services/businesses.ts).
const ALLOWED_TARGET_TYPES = B2B_ALLOWED_SELLER_TYPES;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTAINER_PADDING = 20;
const DISCOVER_GRID_GAP = 10;
// Math.floor (no Math.round): con Math.round, 2*ancho + gap puede superar
// por 1px el ancho real de pantalla (frecuente en Android) y ese único
// píxel de más hace que flexWrap mande la segunda tarjeta a la siguiente
// línea -- la grilla "colapsa" a 1 columna.
const DISCOVER_CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - CONTAINER_PADDING * 2 - DISCOVER_GRID_GAP) / 2
);

const TYPE_FILTER_LABELS: Record<BusinessType, string> = {
  workshop: 'Talleres',
  store: 'Tiendas',
  brand_advertiser: 'Marcas',
};

const ratingFilters = [
  { label: 'Todas', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '4.5+ ★', value: 4.5 },
];

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={28} color={colors.textMuted} />
      <Text style={styles.placeholder}>{text}</Text>
    </View>
  );
}

export default function BusinessBuscarScreen() {
  const { profile } = useAuth();
  const { coords } = useLocation();

  // null mientras no se sabe todavia -- undefined en la busqueda real
  // significaria "sin restriccion de tipo", que nunca es lo que queremos acá.
  const [allowedTypes, setAllowedTypes] = useState<BusinessType[] | null>(null);
  const typeFilters = [
    { label: 'Todos', value: undefined as BusinessType | undefined },
    ...(allowedTypes ?? []).map((t) => ({ label: TYPE_FILTER_LABELS[t], value: t as BusinessType | undefined })),
  ];

  const [query, setQuery] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(undefined);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [only24h, setOnly24h] = useState(false);
  const [results, setResults] = useState<BusinessWithDistance[]>([]);
  const [catalogResults, setCatalogResults] = useState<FeedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialSearchRef = useRef(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!profile) return;
    getMyWorkBusiness(profile.id)
      .then((work) => {
        const viewerType = work?.business?.business_type;
        setAllowedTypes((viewerType && ALLOWED_TARGET_TYPES[viewerType]) || []);
      })
      .catch((err) => {
        console.error('load viewer business type error', err);
        setAllowedTypes([]);
      });
  }, [profile]);

  const search = useCallback(async () => {
    if (!allowedTypes || allowedTypes.length === 0) return;
    try {
      const city = await getNearestCity(coords);
      const [result, catalog, matchingAd] = await Promise.all([
        searchBusinesses({
          query: query || undefined,
          businessType,
          businessTypeIn: businessType ? undefined : allowedTypes,
          coords,
          minRating,
          only24h: only24h || undefined,
        }),
        query.trim()
          ? searchCatalog({ query, kinds: ['product'], businessTypeIn: allowedTypes })
          : Promise.resolve([]),
        // Un anuncio activo que coincida con lo buscado se muestra como el
        // primer resultado de la sección (ya no aparte, en "Publicidad").
        query.trim()
          ? searchActiveAds(query, city, { kinds: ['product'], businessTypeIn: allowedTypes })
          : Promise.resolve(null),
      ]);
      setResults(result);
      setCatalogResults(matchingAd ? [matchingAd, ...catalog] : catalog);
    } catch (err) {
      console.error('search businesses error', err);
    }
  }, [query, businessType, coords, minRating, only24h, allowedTypes]);

  useEffect(() => {
    if (!allowedTypes) return;
    if (!didInitialSearchRef.current) {
      didInitialSearchRef.current = true;
      setLoading(true);
      search().finally(() => setLoading(false));
    } else {
      search().catch((err) => console.error('search background refresh error', err));
    }
  }, [search]);

  const hasActiveFilterParams = !!businessType || !!minRating || only24h;
  const hasActiveFilters = !!query || hasActiveFilterParams;
  // Resumen de los filtros del panel para mostrar algo cuando está cerrado.
  const activeFilterLabels = [
    businessType ? typeFilters.find((f) => f.value === businessType)?.label : null,
    minRating ? ratingFilters.find((f) => f.value === minRating)?.label : null,
    only24h ? '24/7' : null,
  ].filter((label): label is string => !!label);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await search();
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
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, styles.searchInputFlex]}
          placeholder="Buscar"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setShowFilters(false)}
        />
        <Pressable
          style={[styles.filterToggleButton, hasActiveFilterParams && styles.filterToggleButtonActive]}
          onPress={() => setShowFilters((prev) => !prev)}
        >
          <Ionicons name="options-outline" size={20} color={hasActiveFilterParams ? '#fff' : colors.primary} />
        </Pressable>
        <InfoButton onPress={() => setShowInfo(true)} accessibilityLabel="Cómo funciona este buscador" />
      </View>

      {showFilters && (
        <>
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
        </>
      )}

      {!showFilters && activeFilterLabels.length > 0 && (
        <Pressable style={styles.activeFiltersRow} onPress={() => setShowFilters(true)}>
          <Text style={styles.activeFiltersText} numberOfLines={1}>
            {activeFilterLabels.join(' · ')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.results}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          // onTouchStart (no onPress) para que cierre el panel de filtros
          // con cualquier toque en esta zona -- scroll, tarjetas de la
          // grilla, anuncios, etc. -- sin bloquear el gesto real de cada uno
          // (a diferencia de la responder chain de onPress, el touch crudo
          // no le quita el toque al hijo que termine reclamándolo).
          onTouchStart={() => setShowFilters(false)}
        >
          <Text style={styles.sectionTitle}>{hasActiveFilters ? 'Resultados' : 'Descubre cerca de ti'}</Text>
          {hasActiveFilters ? (
            results.length === 0 && catalogResults.length === 0 ? (
              <EmptyState
                text={
                  query.trim()
                    ? `No se encontraron resultados para "${query.trim()}".`
                    : 'No encontramos negocios con esos filtros.'
                }
              />
            ) : (
              <>
                {results.length > 0 && (
                  <View style={styles.discoverGrid}>
                    {results.map((business) => (
                      <BusinessDiscoverCard
                        key={business.id}
                        business={business}
                        width={DISCOVER_CARD_WIDTH}
                        hrefPrefix="/(business)"
                      />
                    ))}
                  </View>
                )}
                {catalogResults.length > 0 && (
                  <FeedCatalogStrip
                    items={catalogResults.filter((item) => item.photoUrl)}
                    listItems={catalogResults.filter((item) => !item.photoUrl)}
                    role="business"
                  />
                )}
              </>
            )
          ) : results.length === 0 ? (
            <EmptyState text="No encontramos negocios con esos filtros." />
          ) : (
            <View style={styles.discoverGrid}>
              {results.map((business) => (
                <BusinessDiscoverCard
                  key={business.id}
                  business={business}
                  width={DISCOVER_CARD_WIDTH}
                  hrefPrefix="/(business)"
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <InfoModal visible={showInfo} title="Cómo funciona este buscador" onClose={() => setShowInfo(false)}>
        <InfoStep number={1} title="Solo ves a quién le puedes comprar">
          <Text style={infoTextStyles.text}>
            Este buscador filtra los tipos de negocio según a quién le puedes pedir productos -- no es un error si ves
            menos filtros que otro negocio.
          </Text>
          <InfoExample label="Ejemplo">
            <Text style={infoTextStyles.exampleText}>Taller → ve los filtros "Tiendas" y "Marcas"</Text>
            <Text style={infoTextStyles.exampleText}>Tienda → ve solo el filtro "Marcas"</Text>
          </InfoExample>
        </InfoStep>

        <InfoStep number={2} title="Por qué no aparecen otros talleres">
          <Text style={infoTextStyles.text}>
            Un taller no le compra a otro taller, así que ningún taller aparece en estos resultados -- este buscador
            es solo para pedidos al por mayor (talleres/tiendas comprándole a tiendas/marcas), no para auxilio en
            carretera ni para que un cliente encuentre un taller.
          </Text>
        </InfoStep>

        <InfoStep number={3} title='Si el botón "Pedir producto" aparece bloqueado'>
          <Text style={infoTextStyles.text}>
            El buscador ya filtra para que esto casi nunca pase, pero si llegas al perfil de un negocio por otro
            camino (ej. un link compartido) y no puedes comprarle, verás un aviso explicando por qué en vez del botón
            de pedir.
          </Text>
        </InfoStep>
      </InfoModal>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
  },
  searchInputFlex: {
    flex: 1,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleButtonActive: {
    backgroundColor: colors.primary,
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
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  activeFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  loading: {
    marginTop: 40,
  },
  results: {
    paddingTop: 4,
  },
  discoverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DISCOVER_GRID_GAP,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
});
