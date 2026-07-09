import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { FeedCatalogStrip } from '../../../components/FeedCatalogStrip';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getProductById, getProductsByCategory, incrementProductViews } from '../../../services/catalog';
import {
  cancelProductIntent,
  createProductIntent,
  getClientIntentForProduct,
  subscribeToClientIntent,
} from '../../../services/productIntents';
import type { ProductWithBusiness, FeedCatalogItem } from '../../../services/catalog';
import type { ProductIntent } from '../../../types/database';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [product, setProduct] = useState<ProductWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ProductIntent | null>(null);
  const [apartando, setApartando] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedItems, setRelatedItems] = useState<FeedCatalogItem[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getProductById(id);
    setProduct(result);
    if (result) {
      incrementProductViews(id).catch((err) => console.error('increment product views error', err));
      getProductsByCategory(result.category_id, id)
        .then(setRelatedItems)
        .catch((err) => console.error('load related products error', err));
    }
    if (profile?.id) {
      getClientIntentForProduct(profile.id, id)
        .then(setIntent)
        .catch((err) => console.error('load intent error', err));
    }
  }, [id, profile?.id]);

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
        router.push({
          pathname: '/(client)/chat/[id]',
          params: {
            id: product.business_id,
            prefill: `Hola, quiero apartar: ${qtyPrefix}${product.name}${product.reference_price != null ? ` ($${(product.reference_price * quantity).toFixed(2)})` : ''}`,
            autoSend: 'true',
          },
        });
      }
    } catch (err) {
      console.error('apartar error', err);
      Alert.alert('Error', 'No se pudo procesar. Intenta de nuevo.');
    } finally {
      setApartando(false);
    }
  }

  useEffect(() => {
    if (profile && profile.role !== 'client' && id) {
      router.replace({ pathname: '/(business)/(tabs)/catalogo', params: { highlightId: id } });
    }
  }, [profile?.role, id]);

  if (loading || (profile && profile.role !== 'client')) {
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
      <Pressable
        style={styles.businessRow}
        onPress={() => router.push(`/(client)/business/${product.business_id}`)}
      >
        <View style={styles.businessAvatarWrap}>
          <View style={styles.businessAvatar}>
            {product.business_logo_url ? (
              <Image source={{ uri: product.business_logo_url }} style={styles.businessAvatarImage} />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
          </View>
          {product.business_is_verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            </View>
          )}
        </View>
        <Text style={styles.businessName} numberOfLines={1}>{product.business_name}</Text>
      </Pressable>
      {product.photos[0] && (
        <Image source={{ uri: product.photos[0] }} style={styles.photo} resizeMode="cover" />
      )}
      <Text style={styles.name}>{product.name}</Text>
      {product.category_name && <Text style={styles.category}>{product.category_name}</Text>}

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
        {product.stock > 0 && profile?.role === 'client' && !intent && (
          <View style={styles.apartarRow}>
            <Button
              title="Apartar producto"
              onPress={handleApartar}
              loading={apartando}
              style={styles.apartarButton}
            />
            <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock} />
          </View>
        )}
        {product.stock > 0 && profile?.role === 'client' && intent && intent.status !== 'confirmed' && (
          <Button
            title="Cancelar apartado"
            onPress={handleApartar}
            loading={apartando}
            style={styles.buttonCancel}
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

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/business/${product.business_id}`)}>
            <Ionicons name="storefront-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver negocio</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/negocio-catalogo/${product.business_id}`)}>
            <Ionicons name="grid-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver catálogo</Text>
          </Pressable>
          {profile?.role === 'client' && (
            <Pressable
              style={styles.actionBtn}
              onPress={() =>
                router.push({
                  pathname: '/(client)/chat/[id]',
                  params: { id: product.business_id, prefill: `Hola, quería preguntar sobre: ${product.name}` },
                })
              }
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Chatear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[styles.sectionTitle, styles.relatedSectionTitle]}>También te puede interesar</Text>
          <FeedCatalogStrip
            items={relatedItems.filter((item) => item.photoUrl)}
            listItems={relatedItems.filter((item) => !item.photoUrl)}
            role="client"
          />
        </View>
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
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  businessAvatarWrap: {
    position: 'relative',
  },
  businessAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessAvatarImage: {
    width: 28,
    height: 28,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  businessName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
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
  relatedSection: {
    marginTop: 28,
    marginHorizontal: -20,
  },
  relatedSectionTitle: {
    paddingHorizontal: 20,
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
  apartarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  apartarButton: {
    flex: 1,
    height: 42,
  },
  actionsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  actionBtnLabel: {
    fontSize: 11,
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
