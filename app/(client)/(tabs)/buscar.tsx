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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BusinessDiscoverCard } from '../../../components/BusinessDiscoverCard';
import { FeedCatalogStrip } from '../../../components/FeedCatalogStrip';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { searchActiveAds } from '../../../services/ads';
import { getNearestCity, searchBusinesses, type BusinessWithDistance } from '../../../services/businesses';
import { searchCatalog, type FeedCatalogItem } from '../../../services/catalog';
import type { BusinessType } from '../../../types/database';

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

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={28} color={colors.textMuted} />
      <Text style={styles.placeholder}>{text}</Text>
    </View>
  );
}

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ service?: string }>();
  const { profile } = useAuth();
  const { coords } = useLocation();

  const [query, setQuery] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(params.service);

  // La pestaña Buscar no se desmonta (lazy: false en (tabs)/_layout.tsx), así
  // que tocar un segundo aviso de mantenimiento para OTRO servicio navega
  // aquí con un nuevo params.service sin remontar el componente -- sin este
  // efecto, el useState de arriba (que solo lee el valor inicial) se queda
  // con el filtro del primer aviso.
  useEffect(() => {
    if (params.service !== undefined) setServiceFilter(params.service);
  }, [params.service]);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [only24h, setOnly24h] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<BusinessWithDistance[]>([]);
  const [catalogResults, setCatalogResults] = useState<FeedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialSearchRef = useRef(false);

  const search = useCallback(async () => {
    try {
      const city = await getNearestCity(coords);
      const [result, catalog, matchingAd] = await Promise.all([
        searchBusinesses({
          query: query || undefined,
          businessType,
          // Sin esto, "Todos" (businessType sin definir) devolvía tambien
          // marcas/brand_advertiser -- el cliente nunca les compra directo
          // (son proveedores B2B para taller/tienda), asi que no tiene
          // sentido que aparezcan en el buscador de negocios del cliente.
          businessTypeIn: businessType ? undefined : ['workshop', 'store'],
          serviceName: serviceFilter,
          coords,
          minRating,
          only24h: only24h || undefined,
        }),
        query.trim() ? searchCatalog({ query, businessTypeIn: ['workshop', 'store'] }) : Promise.resolve([]),
        // Un anuncio activo que coincida con lo buscado se muestra como el
        // primer resultado de la sección (ya no aparte, en "Publicidad").
        query.trim()
          ? searchActiveAds(query, city, coords, { kinds: ['product', 'service'], businessTypeIn: ['workshop', 'store'] })
          : Promise.resolve(null),
      ]);
      setResults(result);
      // Si el anuncio que coincide está vinculado a un producto/servicio ya
      // publicado, ese mismo ítem también puede venir en `catalog` (resultado
      // orgánico) -- se excluye para no mostrarlo duplicado, ya que la
      // tarjeta del anuncio lleva a esa misma ficha.
      const filteredCatalog = matchingAd?.linkedItemId
        ? catalog.filter((item) => !(item.kind === matchingAd.kind && item.id === matchingAd.linkedItemId))
        : catalog;
      setCatalogResults(matchingAd ? [matchingAd, ...filteredCatalog] : filteredCatalog);
    } catch (err) {
      console.error('search businesses error', err);
    }
  }, [query, businessType, serviceFilter, coords, minRating, only24h]);

  // search depende de coords, que arranca en null y se resuelve un instante
  // después (permiso/GPS) -- eso cambiaba la identidad de search y volvía a
  // tapar toda la pantalla (filtros incluidos) con el spinner. Solo se hace
  // eso la primera vez; los cambios siguientes (coords resuelto, o el
  // usuario cambiando un filtro) actualizan los resultados sin ocultar la UI.
  useEffect(() => {
    if (!didInitialSearchRef.current) {
      didInitialSearchRef.current = true;
      setLoading(true);
      search().finally(() => setLoading(false));
    } else {
      search().catch((err) => console.error('search background refresh error', err));
    }
  }, [search]);

  const hasActiveFilterParams = !!businessType || !!serviceFilter || !!minRating || only24h;
  const hasActiveFilters = !!query || hasActiveFilterParams;
  // Resumen de los filtros del panel (tipo/calificación/24h) para mostrar
  // algo cuando el panel está cerrado -- serviceFilter no entra acá porque
  // ya tiene su propio chip siempre visible con botón de quitar.
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
        <Text style={styles.limitedText}>
          Tu cuenta está limitada y no puedes buscar talleres por ahora. Si necesitas ayuda en carretera, usa el botón
          SOS.
        </Text>
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
          <Ionicons name="options-outline" size={22} color={hasActiveFilterParams ? '#fff' : colors.primary} />
        </Pressable>
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
                      <BusinessDiscoverCard key={business.id} business={business} width={DISCOVER_CARD_WIDTH} />
                    ))}
                  </View>
                )}
                {catalogResults.length > 0 && (
                  <FeedCatalogStrip
                    items={catalogResults.filter((item) => item.photoUrl)}
                    listItems={catalogResults.filter((item) => !item.photoUrl)}
                    role="client"
                  />
                )}
              </>
            )
          ) : results.length === 0 ? (
            <EmptyState text="No encontramos negocios con esos filtros." />
          ) : (
            <View style={styles.discoverGrid}>
              {results.map((business) => (
                <BusinessDiscoverCard key={business.id} business={business} width={DISCOVER_CARD_WIDTH} />
              ))}
            </View>
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
    paddingTop: 36,
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
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleButtonActive: {
    borderColor: colors.primary,
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
