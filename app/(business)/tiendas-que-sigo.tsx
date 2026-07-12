import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getFollowedBusinesses } from '../../services/businesses';
import type { Business } from '../../types/database';

export default function TiendasQueSigoScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `tiendas-que-sigo-${profile.id}` : null;
  const { data, loading, reload } = useCachedLoad<Business[]>(cacheKey, async () => {
    if (!profile) return [];
    return getFollowedBusinesses(profile.id);
  });
  const stores = data ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load tiendas que sigo error', err);
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {stores.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no sigues a ninguna tienda. Búscalas en "Buscar" y síguelas para ver sus novedades.</Text>
      ) : (
        stores.map((store) => (
          <Pressable key={store.id} style={styles.card} onPress={() => router.push(`/(business)/business/${store.id}`)}>
            <View style={styles.avatar}>
              {store.logo_url ? (
                <Image source={{ uri: store.logo_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="storefront" size={22} color={colors.primary} />
              )}
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{store.name}</Text>
                {store.is_verified && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
              </View>
              <Text style={styles.cardMeta}>{store.city}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}
    </ScrollView>
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
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
