import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientShade } from '../../../components/GradientShade';
import { colors } from '../../../constants/colors';
import { useCachedLoad } from '../../../hooks/useCachedLoad';
import { getBusinessById } from '../../../services/businesses';
import { getActiveProducts, getActiveServices } from '../../../services/catalog';
import type { Business, Product, Service } from '../../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));

interface CatalogDisplayItem {
  id: string;
  name: string;
  reference_price: number | null;
  photos: string[];
}

function formatItemPrice(referencePrice: number | null): string {
  return referencePrice !== null ? `$${Number(referencePrice).toFixed(2)}` : 'Consultar';
}

// Pantalla dedicada solo a Servicios/Productos -- sin anuncios, sin Seguir,
// sin publicaciones -- separada del perfil del negocio (business/[id].tsx)
// porque el botón "Ver catálogo" ahora es independiente de "Ver negocio".
interface NegocioCatalogoData {
  business: Business | null;
  services: Service[];
  products: Product[];
}

export default function NegocioCatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = id ? `negocio-catalogo-${id}` : null;
  const { data, loading, reload } = useCachedLoad<NegocioCatalogoData>(cacheKey, async () => {
    if (!id) return { business: null, services: [], products: [] };
    const [businessResult, servicesResult, productsResult] = await Promise.all([
      getBusinessById(id),
      getActiveServices(id),
      getActiveProducts(id),
    ]);
    return { business: businessResult, services: servicesResult, products: productsResult };
  });
  const business = data?.business ?? null;
  const services = data?.services ?? [];
  const products = data?.products ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('negocio catalogo load error', err);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este negocio no existe.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Stack.Screen options={{ title: business.name }} />

      {/* Cabecera del negocio */}
      <View style={styles.businessHeader}>
        <View style={styles.businessLogoWrap}>
          {business.logo_url ? (
            <Image source={{ uri: business.logo_url }} style={styles.businessLogo} />
          ) : (
            <Ionicons name="storefront" size={28} color={colors.primary} />
          )}
        </View>
        <View style={styles.businessInfo}>
          <View style={styles.businessNameRow}>
            <Text style={styles.businessName}>{business.name}</Text>
            {business.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            )}
          </View>
          <Text style={styles.businessCity}>{business.city}</Text>
        </View>
      </View>

      {business.business_type === 'workshop' && (
        <Section title="Servicios">
          {services.length === 0 ? (
            <Text style={styles.placeholder}>Este negocio aún no publicó servicios.</Text>
          ) : (
            <CatalogGrid items={services} hrefBase="/(client)/servicio" />
          )}
        </Section>
      )}

      <Section title="Productos">
        {products.length === 0 ? (
          <Text style={styles.placeholder}>Este negocio aún no publicó productos.</Text>
        ) : (
          <CatalogGrid items={products} hrefBase="/(client)/producto" />
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

function CatalogGrid({ items, hrefBase }: { items: CatalogDisplayItem[]; hrefBase: string }) {
  const withPhoto = items.filter((item) => item.photos.length > 0);
  const withoutPhoto = items.filter((item) => item.photos.length === 0);
  return (
    <>
      {withPhoto.length > 0 && (
        <View style={styles.grid}>
          {withPhoto.map((item) => (
            <Pressable key={item.id} style={styles.gridCard} onPress={() => router.push(`${hrefBase}/${item.id}`)}>
              <Image source={{ uri: item.photos[0] }} style={styles.gridImage} resizeMode="cover" />
              <GradientShade height={Math.round(CARD_HEIGHT * 0.55)} />
              <Text numberOfLines={1} style={styles.gridName}>
                {item.name}
              </Text>
              <Text style={styles.gridPrice}>{formatItemPrice(item.reference_price)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {withoutPhoto.length > 0 && (
        <View style={[withPhoto.length > 0 && styles.listWrapWithGrid]}>
          {withoutPhoto.map((item) => (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => router.push(`${hrefBase}/${item.id}`)}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatItemPrice(item.reference_price)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
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
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  businessLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessLogo: {
    width: 48,
    height: 48,
  },
  businessInfo: {
    flex: 1,
  },
  businessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  businessCity: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
    padding: 8,
  },
  gridImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  gridPrice: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  listWrapWithGrid: {
    marginTop: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
