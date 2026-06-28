import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GradientShade } from '../../../components/GradientShade';
import { colors } from '../../../constants/colors';
import { getBusinessById } from '../../../services/businesses';
import { getActiveProducts, getActiveServices } from '../../../services/catalog';
import type { Business, Product, Service } from '../../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.1);

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
export default function NegocioCatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [businessResult, servicesResult, productsResult] = await Promise.all([
      getBusinessById(id),
      getActiveServices(id),
      getActiveProducts(id),
    ]);
    setBusiness(businessResult);
    setServices(servicesResult);
    setProducts(productsResult);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('negocio catalogo load error', err))
      .finally(() => setLoading(false));
  }, [load]);

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{business.name}</Text>

      <Section title="Servicios">
        {services.length === 0 ? (
          <Text style={styles.placeholder}>Este negocio aún no publicó servicios.</Text>
        ) : (
          <CatalogGrid items={services} hrefBase="/(client)/servicio" />
        )}
      </Section>

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
    paddingTop: 36,
    paddingBottom: 32,
    backgroundColor: colors.background,
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
