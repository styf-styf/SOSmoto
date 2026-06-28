import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import type { StoryFeedItem } from '../services/stories';

export interface StoriesRowOwnSlot {
  hasStory: boolean;
  avatarUrl: string | null;
  previewImageUrl: string | null;
  onPress: () => void;
}

export interface StoriesRowItem extends StoryFeedItem {
  onPress: () => void;
}

type RowEntry = { type: 'own'; own: StoriesRowOwnSlot } | { type: 'other'; item: StoriesRowItem };

// Fila única de "Estados" (al estilo WhatsApp): tarjetas verticales con la
// miniatura de la historia de fondo, el primer espacio es siempre el propio
// (con un "+" si todavía no tiene historia activa) -- se usa igual en el
// home del cliente y el del negocio, cada uno arma `own`/`items` con su data.
export function StoriesRow({ own, items }: { own: StoriesRowOwnSlot; items: StoriesRowItem[] }) {
  const data: RowEntry[] = [{ type: 'own', own }, ...items.map((item) => ({ type: 'other' as const, item }))];

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(entry) => (entry.type === 'own' ? 'own' : entry.item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item: entry }) => {
        if (entry.type === 'own') {
          const { own: slot } = entry;
          return (
            <Pressable style={styles.card} onPress={slot.onPress}>
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
              {!slot.hasStory && (
                <View style={styles.addBadge}>
                  <Ionicons name="add" size={14} color="#fff" />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={1}>
                {slot.hasStory ? 'Tu historia' : 'Añadir'}
              </Text>
            </Pressable>
          );
        }

        const { item } = entry;
        return (
          <Pressable style={styles.card} onPress={item.onPress}>
            <Image source={{ uri: item.previewImageUrl }} style={styles.cardImage} resizeMode="cover" />
            <GradientShade height={60} />
            <View style={[styles.avatarBadge, item.hasUnseen ? styles.avatarBadgeUnseen : styles.avatarBadgeSeen]}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name={item.kind === 'business' ? 'storefront' : 'person'} size={14} color={colors.primary} />
              )}
            </View>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const CARD_WIDTH = 80;
const CARD_HEIGHT = 132;

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingLeft: 10,
    paddingBottom: 8,
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
  cardImagePlaceholder: {
    backgroundColor: colors.border,
  },
  avatarBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
  addBadge: {
    position: 'absolute',
    top: 28,
    left: 28,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
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
