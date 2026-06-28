import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import type { FeedCatalogItem } from '../services/catalog';

// No es un feed propio (sin comentarios/compartir) -- es un banner de
// descubrimiento de catálogo. Mismo lenguaje visual que StoriesRow (tarjeta
// vertical con imagen de fondo + degradado + nombre), pero más grande: 3
// tarjetas visibles por pantalla en vez de las 4 de Historias.
const VISIBLE_CARDS = 3;
const GAP = 10;
const SIDE_PADDING = 10;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING - GAP * VISIBLE_CARDS) / VISIBLE_CARDS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.65);

export function FeedCatalogStrip({
  items,
  listItems,
  grayBackground = false,
  showTopShadow = true,
  showBottomShadow = true,
}: {
  // Carrusel de fotos -- siempre items con imagen (el degradado + texto
  // blanco necesita una foto debajo para verse bien).
  items: FeedCatalogItem[];
  // Servicios/productos sin foto: en vez de forzar el mismo overlay sobre un
  // fondo liso (se veía como una tarjeta rota), van aparte como una lista
  // compacta debajo del carrusel.
  listItems: FeedCatalogItem[];
  // Cuando el bloque queda pegado (arriba o abajo) a un post sin imagen,
  // HomeFeed le pasa el mismo fondo gris y apaga la sombra del lado
  // compartido, para que los dos se vean como un solo bloque de fondo.
  grayBackground?: boolean;
  showTopShadow?: boolean;
  showBottomShadow?: boolean;
}) {
  return (
    <View style={[styles.container, grayBackground && styles.containerGray]}>
      {grayBackground && showTopShadow && <GradientShade position="top" height={8} maxOpacity={0.12} />}
      {items.length > 0 && (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CatalogCard item={item} />}
        />
      )}
      {listItems.length > 0 && (
        <View style={[styles.listWrap, items.length > 0 && styles.listWrapWithCarousel]}>
          {listItems.map((item) => (
            <CatalogListRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </View>
      )}
      {grayBackground && showBottomShadow && <GradientShade position="bottom" height={8} maxOpacity={0.12} />}
    </View>
  );
}

function formatPrice(referencePrice: number | null): string {
  return referencePrice !== null ? `$${referencePrice.toFixed(2)}` : 'Consultar';
}

function BusinessAvatar({ logoUrl, size = 16 }: { logoUrl?: string; size?: number }) {
  return (
    <View style={[styles.businessAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: size, height: size }} />
      ) : (
        <Ionicons name="storefront" size={size * 0.6} color={colors.primary} />
      )}
    </View>
  );
}

function CatalogCard({ item }: { item: FeedCatalogItem }) {
  const href = item.kind === 'service' ? `/(client)/servicio/${item.id}` : `/(client)/producto/${item.id}`;
  return (
    <Pressable style={styles.card} onPress={() => router.push(href)}>
      <Image source={{ uri: item.photoUrl }} style={styles.cardImage} resizeMode="cover" />
      <GradientShade height={Math.round(CARD_HEIGHT * 0.45)} />
      <View style={styles.businessBadge}>
        <BusinessAvatar logoUrl={item.businessLogoUrl} />
        <Text numberOfLines={1} style={styles.businessName}>
          {item.businessName}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.cardName}>
        {item.name}
      </Text>
      <Text style={styles.cardPrice}>{formatPrice(item.referencePrice)}</Text>
    </Pressable>
  );
}

function CatalogListRow({ item }: { item: FeedCatalogItem }) {
  const href = item.kind === 'service' ? `/(client)/servicio/${item.id}` : `/(client)/producto/${item.id}`;
  return (
    <Pressable style={styles.listRow} onPress={() => router.push(href)}>
      <View style={styles.listIcon}>
        <Ionicons name={item.kind === 'service' ? 'construct-outline' : 'cube-outline'} size={18} color={colors.primary} />
      </View>
      <View style={styles.listInfo}>
        <Text numberOfLines={1} style={styles.listName}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.listMeta}>
          {item.businessName}
        </Text>
      </View>
      <Text style={styles.listPrice}>{formatPrice(item.referencePrice)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  containerGray: {
    backgroundColor: colors.surface,
  },
  list: {
    gap: GAP,
    paddingLeft: SIDE_PADDING,
    paddingVertical: 8,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  businessBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  businessAvatar: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessName: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  cardName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 26,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  cardPrice: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  listWrap: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 8,
  },
  listWrapWithCarousel: {
    paddingTop: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  listMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  listPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
