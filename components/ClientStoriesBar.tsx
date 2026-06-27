import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

export interface ClientStoryAuthorItem {
  client: { id: string; full_name: string; avatar_url: string | null };
  hasUnseen: boolean;
  isOwn?: boolean;
}

export function ClientStoriesBar({ items }: { items: ClientStoryAuthorItem[] }) {
  if (items.length === 0) return null;

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(item) => item.client.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={styles.item}
          onPress={() => router.push(`/(client)/historia-cliente/${item.client.id}`)}
        >
          <View style={[styles.ring, item.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
            <View style={styles.avatar}>
              {item.client.avatar_url ? (
                <Image source={{ uri: item.client.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={22} color={colors.primary} />
              )}
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.isOwn ? 'Tú' : item.client.full_name}
          </Text>
        </Pressable>
      )}
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
  name: {
    fontSize: 11,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
});
