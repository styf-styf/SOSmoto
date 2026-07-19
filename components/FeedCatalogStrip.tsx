import { useEffect, useRef } from 'react';
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import { registerAdClick, registerAdImpression } from '../services/ads';
import type { FeedCatalogItem } from '../services/catalog';

// No es un feed propio (sin comentarios/compartir) -- es un banner de
// descubrimiento de catálogo. Mismo lenguaje visual que StoriesRow (tarjeta
// vertical con imagen de fondo + degradado + nombre), pero más grande: 3
// tarjetas visibles por pantalla en vez de las 4 de Historias.
const VISIBLE_CARDS = 3;
const GAP = 6;
const SIDE_PADDING = 6;
const CARD_PEEK = 20; // franja de la 4ta tarjeta visible como pista de scroll
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING - GAP * VISIBLE_CARDS - CARD_PEEK) / VISIBLE_CARDS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));
// Ver PostCard.tsx: mismo problema con un carrusel horizontal de Pressables --
// un swipe corto puede colarse como tap antes de que el FlatList reclame el
// gesto. Se cancela la navegación si hubo desplazamiento al soltar el dedo.
const CARD_SWIPE_THRESHOLD = 10;

export function FeedCatalogStrip({
  items,
  listItems,
  role = 'client',
}: {
  items: FeedCatalogItem[];
  listItems: FeedCatalogItem[];
  role?: 'client' | 'business';
}) {
  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CatalogCard item={item} role={role} />}
        />
      )}
      {listItems.length > 0 && (
        <View style={[styles.listWrap, items.length > 0 && styles.listWrapWithCarousel]}>
          {listItems.map((item) => (
            <CatalogListRow key={`${item.kind}-${item.id}`} item={item} role={role} />
          ))}
        </View>
      )}
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

function CatalogCard({ item, role = 'client' }: { item: FeedCatalogItem; role?: 'client' | 'business' }) {
  const prefix = role === 'business' ? '/(business)' : '/(client)';
  const href = item.isAd
    ? `${prefix}/anuncio/${item.adId}`
    : item.kind === 'service'
      ? `${prefix}/servicio/${item.id}`
      : `${prefix}/producto/${item.id}`;
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (item.isAd && item.adId) registerAdImpression(item.adId);
    // Solo al montar -- una impresión por vez que la tarjeta aparece en pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn(e: GestureResponderEvent) {
    touchStartXRef.current = e.nativeEvent.pageX;
  }

  function handlePress(e: GestureResponderEvent) {
    const startX = touchStartXRef.current;
    if (startX !== null && Math.abs(e.nativeEvent.pageX - startX) > CARD_SWIPE_THRESHOLD) return;
    if (item.isAd && item.adId) registerAdClick(item.adId);
    router.push(href);
  }

  return (
    <View style={styles.cardShadow}>
      <Pressable style={styles.card} onPressIn={handlePressIn} onPress={handlePress}>
        <Image source={{ uri: item.photoUrl }} style={styles.cardImage} resizeMode="cover" />
        <GradientShade height={Math.round(CARD_HEIGHT * 0.45)} />
        <View style={[styles.businessBadge, item.isAd && styles.businessBadgeWithAdChip]}>
          <BusinessAvatar logoUrl={item.businessLogoUrl} />
          <Text numberOfLines={1} style={styles.businessName}>
            {item.businessName}
          </Text>
        </View>
        {item.isAd && (
          <View style={styles.adChip}>
            <Ionicons name="megaphone" size={11} color="#fff" />
          </View>
        )}
        <Text numberOfLines={1} style={styles.cardName}>
          {item.name}
        </Text>
        <Text style={styles.cardPrice}>{formatPrice(item.referencePrice)}</Text>
      </Pressable>
    </View>
  );
}

function CatalogListRow({ item, role = 'client' }: { item: FeedCatalogItem; role?: 'client' | 'business' }) {
  const prefix = role === 'business' ? '/(business)' : '/(client)';
  const href = item.kind === 'service' ? `${prefix}/servicio/${item.id}` : `${prefix}/producto/${item.id}`;
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
  container: {},
  list: {
    gap: GAP,
    paddingLeft: SIDE_PADDING,
    paddingRight: SIDE_PADDING,
    paddingVertical: 8,
  },
  // Mismo patrón que PostCard/AdBanner: la sombra vive en el wrapper exterior
  // (sin overflow) y el recorte de bordes redondeados en el interior, porque
  // overflow:'hidden' en la misma vista que la sombra la recorta también.
  // Cada tarjeta del carrusel es su propia tarjeta flotante (no el carrusel
  // completo) -- los items sin foto (listItems) se quedan como filas simples
  // sobre el fondo gris del feed, sin caja blanca.
  cardShadow: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  card: {
    flex: 1,
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
  // Dejar espacio a la derecha para el chip "Anuncio" (ver adChip) cuando la
  // tarjeta es un anuncio mezclado en el carrusel de catálogo.
  businessBadgeWithAdChip: {
    right: 30,
  },
  adChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 4,
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
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 26,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardPrice: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
