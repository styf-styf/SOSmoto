import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { StoryFeedItem } from '../services/stories';

export interface StoriesRowOwnSlot {
  hasStory: boolean;
  avatarUrl: string | null;
  onPress: () => void;
}

export interface StoriesRowItem extends StoryFeedItem {
  onPress: () => void;
}

type RowEntry =
  | { type: 'own'; own: StoriesRowOwnSlot }
  | { type: 'other'; item: StoriesRowItem };

// Fila única de "Estados" (al estilo WhatsApp): el primer espacio es siempre
// el propio (con un "+" si todavía no tiene historia activa), seguido de las
// historias de los demás -- se usa igual en el home del cliente y el del
// negocio, cada uno arma `own`/`items` con su propia data.
export function StoriesRow({ own, items }: { own: StoriesRowOwnSlot; items: StoriesRowItem[] }) {
  const data: RowEntry[] = [{ type: 'own', own }, ...items.map((item) => ({ type: 'other' as const, item }))];

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(entry, index) => (entry.type === 'own' ? 'own' : entry.item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item: entry }) => {
        if (entry.type === 'own') {
          return (
            <Pressable style={styles.item} onPress={entry.own.onPress}>
              <View style={[styles.ring, styles.ringSeen]}>
                <View style={styles.avatar}>
                  {entry.own.avatarUrl ? (
                    <Image source={{ uri: entry.own.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={22} color={colors.primary} />
                  )}
                </View>
                {!entry.own.hasStory && (
                  <View style={styles.addBadge}>
                    <Ionicons name="add" size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {entry.own.hasStory ? 'Tu historia' : 'Añadir'}
              </Text>
            </Pressable>
          );
        }

        const { item } = entry;
        return (
          <Pressable style={styles.item} onPress={item.onPress}>
            <View style={[styles.ring, item.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
              <View style={styles.avatar}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name={item.kind === 'business' ? 'storefront' : 'person'} size={22} color={colors.primary} />
                )}
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
    paddingBottom: 16,
  },
  item: {
    width: 68,
    alignItems: 'center',
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  ringUnseen: {
    borderColor: colors.primary,
  },
  ringSeen: {
    borderColor: colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: {
    fontSize: 11,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
});
