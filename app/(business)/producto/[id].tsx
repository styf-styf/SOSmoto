import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getProductById, incrementProductViews } from '../../../services/catalog';
import {
  cancelProductIntent,
  createProductIntent,
  getClientIntentForProduct,
  subscribeToClientIntent,
} from '../../../services/productIntents';
import type { ProductWithBusiness } from '../../../services/catalog';
import type { ProductIntent } from '../../../types/database';

export default function BusinessProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [product, setProduct] = useState<ProductWithBusiness | null>(null);
  const [canBuy, setCanBuy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ProductIntent | null>(null);
  const [apartando, setApartando] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    const [result, work] = await Promise.all([
      getProductById(id),
      getMyWorkBusiness(profile.id),
    ]);
    setProduct(result);
    if (result) incrementProductViews(id).catch((err) => console.error('increment product views error', err));

    if (work) {
      setCanBuy(work.business.business_type === 'workshop' && work.business.id !== result?.business_id);
    }

    getClientIntentForProduct(profile.id, id)
      .then(setIntent)
      .catch((err) => console.error('load intent error', err));
  }, [id, profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load product detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!profile?.id || !id) return;
    return subscribeToClientIntent(profile.id, id, setIntent, () => {
      Alert.alert('No disponible', 'El negocio indicó que este producto no está disponible en este momento.');
    });
  }, [profile?.id, id]);

  async function handleApartar() {
    if (!profile || !product) return;
    setApartando(true);
    try {
      if (intent) {
        await cancelProductIntent(intent.id);
        setIntent(null);
        setQuantity(1);
      } else {
        const newIntent = await createProductIntent(profile.id, product.id, product.business_id, quantity);
        setIntent(newIntent);
        const qtyPrefix = quantity > 1 ? `${quantity} x ` : '';
        const msg = encodeURIComponent(
          `Hola, quiero apartar: ${qtyPrefix}${product.name}${product.reference_price != null ? ` ($${(product.reference_price * quantity).toFixed(2)})` : ''}`
        );
        router.push(`/(business)/chat/${product.business_owner_id}?initialMessage=${msg}&sellerBusinessId=${product.business_id}`);
      }
    } catch (err) {
      console.error('apartar error', err);
      Alert.alert('Error', 'No se pudo procesar. Intenta de nuevo.');
    } finally {
      setApartando(false);
    }
  }

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
      <Stack.Screen options={{ title: product.name }} />
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
        {product.stock > 0 && canBuy && !intent && (
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Cantidad</Text>
            <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock} />
          </View>
        )}
        {product.stock > 0 && canBuy && intent?.status !== 'confirmed' && (
          <Button
            title={intent ? 'Cancelar apartado' : 'Apartar producto'}
            onPress={handleApartar}
            loading={apartando}
            style={intent ? styles.buttonCancel : styles.button}
          />
        )}
        {intent?.status === 'pending' && (
          <Text style={styles.intentBadge}>
            Apartado ({intent.quantity}) — en espera de confirmación del negocio
          </Text>
        )}
        {intent?.status === 'confirmed' && (
          <Text style={[styles.intentBadge, styles.intentBadgeConfirmed]}>
            ✓ Apartado ({intent.quantity}) confirmado por el negocio
          </Text>
        )}
        <Button
          title="Chatear con el negocio"
          variant="secondary"
          onPress={() => {
            const msg = encodeURIComponent(`Hola, estoy interesado en el producto "${product.name}". ¿Podrían darme más información?`);
            router.push(`/(business)/chat/${product.business_owner_id}?initialMessage=${msg}&sellerBusinessId=${product.business_id}`);
          }}
          style={styles.button}
        />
        <Button
          title="Ver negocio"
          variant="secondary"
          onPress={() => router.push(`/(business)/business/${product.business_id}`)}
          style={styles.button}
        />
        <Button
          title="Ver catálogo"
          variant="secondary"
          onPress={() => router.push(`/(business)/negocio-catalogo/${product.business_id}`)}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  button: {},
  buttonCancel: {
    backgroundColor: colors.danger,
  },
  intentBadge: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  intentBadgeConfirmed: {
    color: colors.success,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
