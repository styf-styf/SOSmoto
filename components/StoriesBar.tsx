import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { Business } from '../types/database';

export interface StoryBusinessItem {
  business: Business;
  hasUnseen: boolean;
}

export function StoriesBar({ items }: { items: StoryBusinessItem[] }) {
  if (items.length === 0) return null;

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(item) => item.business.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={styles.item}
          onPress={() => router.push(`/(client)/historia/${item.business.id}`)}
        >
          <View style={[styles.ring, item.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
            <View style={styles.avatar}>
              <Ionicons name="storefront" size={22} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.business.name}
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
  },
  name: {
    fontSize: 11,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
});
