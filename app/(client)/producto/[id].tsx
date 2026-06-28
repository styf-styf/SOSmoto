import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { getProductById } from '../../../services/catalog';
import type { ProductWithBusiness } from '../../../services/catalog';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ProductWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getProductById(id);
    setProduct(result);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load product detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este producto ya no está disponible.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {product.photos[0] && (
        <Image source={{ uri: product.photos[0] }} style={styles.photo} resizeMode="cover" />
      )}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.business}>{product.business_name}</Text>
      {product.category && <Text style={styles.category}>{product.category}</Text>}

      <Text style={styles.price}>
        {product.reference_price !== null ? `$${product.reference_price.toFixed(2)}` : 'Precio a consultar'}
      </Text>
      <Text style={styles.stock}>
        {product.stock > 0 ? `Disponible · ${product.stock} en stock` : 'Sin stock disponible'}
      </Text>

      {product.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        <Button
          title="Ver negocio"
          onPress={() => router.push(`/(client)/business/${product.business_id}`)}
          style={styles.button}
        />
        <Button
          title="Ver catálogo"
          variant="secondary"
          onPress={() => router.push(`/(client)/negocio-catalogo/${product.business_id}`)}
          style={styles.button}
        />
        <Button
          title="Chatear"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/(client)/chat/[id]',
              params: { id: product.business_id, prefill: `Hola, quería preguntar sobre: ${product.name}` },
            })
          }
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  business: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  category: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  stock: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  buttonGroup: {
    marginTop: 32,
    gap: 10,
  },
  button: {},
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
