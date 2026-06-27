import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { FeedCatalogItem } from '../services/catalog';

export function FeedCatalogCard({ item }: { item: FeedCatalogItem }) {
  const href = item.kind === 'service' ? `/(client)/servicio/${item.id}` : `/(client)/producto/${item.id}`;

  return (
    <Pressable style={styles.card} onPress={() => router.push(href)}>
      <View style={styles.badge}>
        <Ionicons name={item.kind === 'service' ? 'construct' : 'cube'} size={12} color={colors.primary} />
        <Text style={styles.badgeText}>{item.kind === 'service' ? 'Servicio' : 'Producto'}</Text>
      </View>

      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}

      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.business} numberOfLines={1}>
        {item.businessName}
      </Text>
      {item.meta && <Text style={styles.meta}>{item.meta}</Text>}
      <Text style={styles.price}>
        {item.referencePrice !== null ? `$${item.referencePrice.toFixed(2)}` : 'Consultar precio'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  imagePlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 10,
  },
  business: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  },
});
