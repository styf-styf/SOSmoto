import { useRef } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import type { StoryFeedItem } from '../services/stories';

export interface StoriesRowOwnSlot {
  hasStory: boolean;
  avatarUrl: string | null;
  previewImageUrl: string | null;
  // Abre el popup de creación -- el botón de añadir se queda siempre en su
  // sitio (no se reemplaza por la historia activa, a diferencia del diseño
  // anterior) para que siempre sea obvio cómo subir una nueva.
  onAddPress: () => void;
  // Abre el visor de la propia historia -- solo se usa cuando hasStory.
  onViewPress: () => void;
}

export interface StoriesRowItem extends StoryFeedItem {
  onPress: () => void;
}

type RowEntry =
  | { type: 'ownAdd'; own: StoriesRowOwnSlot }
  | { type: 'ownStory'; own: StoriesRowOwnSlot }
  | { type: 'other'; item: StoriesRowItem };

// Ver PostCard.tsx: mismo problema con un carrusel horizontal de Pressables --
// un swipe corto puede colarse como tap antes de que el FlatList reclame el
// gesto. Se cancela el onPress si hubo desplazamiento al soltar el dedo.
const CARD_SWIPE_THRESHOLD = 10;

export function StoriesRow({ own, items }: { own: StoriesRowOwnSlot; items: StoriesRowItem[] }) {
  const data: RowEntry[] = [
    { type: 'ownAdd', own },
    ...(own.hasStory ? [{ type: 'ownStory' as const, own }] : []),
    ...items.map((item) => ({ type: 'other' as const, item })),
  ];
  const touchStartXRef = useRef<number | null>(null);

  function handlePressIn(e: GestureResponderEvent) {
    touchStartXRef.current = e.nativeEvent.pageX;
  }

  function guardSwipe(e: GestureResponderEvent, onPress: () => void) {
    const startX = touchStartXRef.current;
    if (startX !== null && Math.abs(e.nativeEvent.pageX - startX) > CARD_SWIPE_THRESHOLD) return;
    onPress();
  }

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(entry) => (entry.type === 'other' ? entry.item.id : entry.type)}
      contentContainerStyle={styles.list}
      renderItem={({ item: entry }) => {
        if (entry.type === 'ownAdd') {
          const { own: slot } = entry;
          return (
            <View style={styles.cardShadow}>
              <Pressable style={styles.card} onPressIn={handlePressIn} onPress={(e) => guardSwipe(e, slot.onAddPress)}>
                {slot.avatarUrl ? (
                  <Image source={{ uri: slot.avatarUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
                <View style={styles.cardOverlay} />
                <View style={styles.addCenter}>
                  <Ionicons name="add" size={28} color="#fff" />
                </View>
                <Text style={styles.cardName} numberOfLines={1}>Añadir</Text>
              </Pressable>
            </View>
          );
        }

        if (entry.type === 'ownStory') {
          const { own: slot } = entry;
          return (
            <View style={styles.cardShadow}>
              <Pressable style={styles.card} onPressIn={handlePressIn} onPress={(e) => guardSwipe(e, slot.onViewPress)}>
                {slot.previewImageUrl ? (
                  <Image source={{ uri: slot.previewImageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                )}
                <GradientShade height={60} />
                <View style={[styles.avatarBadge, styles.avatarBadgeSeen]}>
                  {slot.avatarUrl ? (
                    <Image source={{ uri: slot.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={14} color={colors.primary} />
                  )}
                </View>
                <Text style={styles.cardName} numberOfLines={1}>Tu historia</Text>
              </Pressable>
            </View>
          );
        }

        const { item } = entry;
        return (
          <View style={styles.cardShadow}>
            <Pressable style={styles.card} onPressIn={handlePressIn} onPress={(e) => guardSwipe(e, item.onPress)}>
              <Image source={{ uri: item.previewImageUrl }} style={styles.cardImage} resizeMode="cover" />
              <GradientShade height={60} />
              <View style={styles.avatarWrap}>
                <View style={[styles.avatarBadge, item.hasUnseen ? styles.avatarBadgeUnseen : styles.avatarBadgeSeen]}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name={item.kind === 'business' ? 'storefront' : 'person'} size={14} color={colors.primary} />
                  )}
                </View>
                {item.isVerified && (
                  <View style={styles.verifiedDot}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                  </View>
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const CARD_WIDTH = 80;
const CARD_HEIGHT = 132;

const styles = StyleSheet.create({
  list: {
    gap: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingBottom: 8,
  },
  // Mismo patrón que PostCard/FeedCatalogStrip: la sombra vive en el wrapper
  // exterior (sin overflow) y el recorte de bordes redondeados en el
  // interior, porque overflow:'hidden' en la misma vista que la sombra la
  // recorta también.
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
  cardImagePlaceholder: {
    backgroundColor: colors.border,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  addCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  avatarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  avatarBadgeUnseen: {
    borderColor: colors.primary,
  },
  avatarBadgeSeen: {
    borderColor: '#fff',
  },
  avatarImage: {
    width: 28,
    height: 28,
  },
  cardName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
