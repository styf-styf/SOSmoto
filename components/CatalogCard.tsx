import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';

interface CatalogCardProps {
  itemId: string;
  itemType: 'service' | 'product';
  businessName: string;
  name: string;
  referencePrice: number | null;
  meta?: string;
  photoUrl?: string | null;
}

export function CatalogCard({ itemId, itemType, businessName, name, referencePrice, meta, photoUrl }: CatalogCardProps) {
  const route = itemType === 'service' ? `/(client)/servicio/${itemId}` : `/(client)/producto/${itemId}`;

  return (
    <Pressable style={styles.card} onPress={() => router.push(route)}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder} />
      )}
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.business} numberOfLines={1}>
        {businessName}
      </Text>
      {meta && <Text style={styles.meta}>{meta}</Text>}
      <Text style={styles.price}>{referencePrice !== null ? `$${referencePrice.toFixed(2)}` : 'Consultar precio'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
  },
  photo: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    marginBottom: 8,
  },
  photoPlaceholder: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    minHeight: 36,
  },
  business: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
});
