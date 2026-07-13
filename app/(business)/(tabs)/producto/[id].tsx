import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { QuantityStepper } from '../../../../components/QuantityStepper';
import { FeedCatalogStrip } from '../../../../components/FeedCatalogStrip';
import { PhotoCarousel } from '../../../../components/PhotoCarousel';
import { ReportModal } from '../../../../components/ReportModal';
import { colors } from '../../../../constants/colors';
import { useAuth } from '../../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../../services/businesses';
import { getProductById, getProductsByCategory, incrementProductViews } from '../../../../services/catalog';
import {
  cancelProductIntent,
  createProductIntent,
  getClientIntentForProduct,
  getProductIntentStats,
  subscribeToClientIntent,
} from '../../../../services/productIntents';
import { createReport } from '../../../../services/reports';
import { consumeProductoServicioResetFlag } from '../../../../utils/productoServicioStackReset';
import type { ProductWithBusiness, FeedCatalogItem } from '../../../../services/catalog';
import type { ProductIntent } from '../../../../types/database';

export default function BusinessProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const navigation = useNavigation();
  const [product, setProduct] = useState<ProductWithBusiness | null>(null);
  const [canBuy, setCanBuy] = useState(false);
  const [viewerIsStore, setViewerIsStore] = useState(false);
  const [isOwnProduct, setIsOwnProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ProductIntent | null>(null);
  const [apartando, setApartando] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedItems, setRelatedItems] = useState<FeedCatalogItem[]>([]);
  const [stats, setStats] = useState<{ reservations: number; sold: number } | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const didInitialLoadRef = useRef(false);

  const hasVariants = !!product && product.variants.length > 0;
  const selectedVariant = product?.variants.find((v) => v.id === selectedVariantId) ?? null;
  const effectivePrice = selectedVariant?.reference_price ?? product?.reference_price ?? null;
  const effectiveStock = hasVariants ? (selectedVariant?.stock ?? 0) : (product?.stock ?? 0);
  const variantId = hasVariants ? selectedVariantId : null;

  const load = useCallback(async () => {
    if (!id) return;
    const [result, work] = await Promise.all([
      getProductById(id),
      profile ? getMyWorkBusiness(profile.id) : Promise.resolve(null),
    ]);
    setProduct(result);
    if (result) {
      incrementProductViews(id).catch((err) => console.error('increment product views error', err));
      getProductsByCategory(result.category_id, id)
        .then(setRelatedItems)
        .catch((err) => console.error('load related products error', err));
      if (result.variants.length > 0) {
        const firstAvailable = result.variants.find((v) => v.stock > 0) ?? result.variants[0];
        setSelectedVariantId(firstAvailable.id);
      }
    }

    const owns = !!(work && result && work.business.id === result.business_id);
    setIsOwnProduct(owns);

    if (owns && result) {
      getProductIntentStats(result.id)
        .then(setStats)
        .catch((err) => console.error('load product stats error', err));
      return;
    }

    if (work) {
      setCanBuy(work.business.business_type === 'workshop');
      setViewerIsStore(work.business.business_type === 'store');
    }
  }, [id, profile]);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      load()
        .catch((err) => console.error('load product detail error', err))
        .finally(() => setLoading(false));
    } else {
      load().catch((err) => console.error('load product detail background refresh error', err));
    }
  }, [load]);

  // Si el usuario volvió a Inicio antes de entrar acá, esta es la primera
  // pantalla de producto que gana foco después de eso: reinicia la pila
  // anidada para que quede como única entrada (ver
  // utils/productoServicioStackReset.ts).
  useFocusEffect(
    useCallback(() => {
      if (consumeProductoServicioResetFlag('producto')) {
        navigation.dispatch((state) => CommonActions.reset({ index: 0, routes: [state.routes[state.index]] } as any));
      }
    }, [navigation])
  );

  // El apartado activo depende de la variante elegida -- se vuelve a pedir
  // cada vez que el usuario cambia de talla/color, y espera a que haya una
  // variante seleccionada si el producto tiene variantes.
  useEffect(() => {
    if (isOwnProduct || !profile?.id || !id || !product) return;
    if (hasVariants && !variantId) return;
    getClientIntentForProduct(profile.id, id, variantId)
      .then(setIntent)
      .catch((err) => console.error('load intent error', err));
  }, [isOwnProduct, profile?.id, id, product, hasVariants, variantId]);

  useEffect(() => {
    if (isOwnProduct || !profile?.id || !id || !product) return;
    if (hasVariants && !variantId) return;
    return subscribeToClientIntent(profile.id, id, variantId, setIntent, () => {
      Alert.alert('No disponible', 'El negocio indicó que este producto no está disponible en este momento.');
    });
  }, [isOwnProduct, profile?.id, id, product, hasVariants, variantId]);

  async function handleApartar() {
    if (!profile || !product) return;
    setApartando(true);
    try {
      if (intent) {
        await cancelProductIntent(intent.id);
        setIntent(null);
        setQuantity(1);
      } else {
        const newIntent = await createProductIntent(profile.id, product.id, product.business_id, quantity, variantId);
        setIntent(newIntent);
        const qtyPrefix = quantity > 1 ? `${quantity} x ` : '';
        const itemLabel = selectedVariant ? `${product.name} (${selectedVariant.label})` : product.name;
        const msg = encodeURIComponent(
          `Hola, quiero apartar: ${qtyPrefix}${itemLabel}${effectivePrice != null ? ` ($${(effectivePrice * quantity).toFixed(2)})` : ''}`
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

  async function handleReportProduct(reason: string) {
    if (!product || !profile) return;
    try {
      await createReport(profile.id, 'product', product.id, reason);
      setShowReportModal(false);
      Alert.alert('Gracias', 'Reportaste este producto. Un admin lo va a revisar.');
    } catch (err) {
      console.error('report product error', err);
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    }
  }

  function handleShare() {
    if (!product) return;
    const url = `https://so-smoto.vercel.app/product/${product.id}`;
    Share.share({ message: `${product.name}\n${url}`, url }).catch(() => {});
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
      <Stack.Screen
        options={{
          title: product.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              {isOwnProduct && (
                <Pressable onPress={handleShare} hitSlop={8}>
                  <Ionicons name="share-social-outline" size={22} color={colors.text} />
                </Pressable>
              )}
              {isOwnProduct ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(business)/(tabs)/catalogo', params: { editId: product.id, editKind: 'product' } })
                  }
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowReportModal(true)} hitSlop={8}>
                  <Ionicons name="flag-outline" size={22} color={colors.text} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <Pressable
        style={styles.businessRow}
        onPress={() => router.push(`/(business)/business/${product.business_id}`)}
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
      <PhotoCarousel photos={product.photos} />
      <Text style={styles.name}>{product.name}</Text>
      {product.category_name && <Text style={styles.category}>{product.category_name}</Text>}

      <Text style={styles.price}>
        {effectivePrice !== null ? `$${effectivePrice.toFixed(2)}` : 'Precio a consultar'}
      </Text>
      <Text style={styles.stock}>
        {effectiveStock > 0 ? `Disponible · ${effectiveStock} en stock` : 'Sin stock disponible'}
      </Text>
      {!!product.min_order_quantity && (
        <Text style={styles.stock}>Pedido mínimo: {product.min_order_quantity} unidades</Text>
      )}

      {hasVariants && (
        <View style={styles.variantRow}>
          {product.variants.map((v) => {
            const selected = v.id === selectedVariantId;
            const outOfStock = v.stock <= 0;
            return (
              <Pressable
                key={v.id}
                disabled={outOfStock}
                onPress={() => setSelectedVariantId(v.id)}
                style={[styles.variantChip, selected && styles.variantChipSelected, outOfStock && styles.variantChipDisabled]}
              >
                <Text
                  style={[
                    styles.variantChipText,
                    selected && styles.variantChipTextSelected,
                    outOfStock && styles.variantChipTextDisabled,
                  ]}
                >
                  {v.label}
                  {outOfStock ? ' (agotado)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {product.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      )}

      {isOwnProduct ? (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{product.views}</Text>
            <Text style={styles.statLabel}>Vistas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.reservations ?? 0}</Text>
            <Text style={styles.statLabel}>Reservas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.sold ?? 0}</Text>
            <Text style={styles.statLabel}>Vendidos</Text>
          </View>
        </View>
      ) : (
        <View style={styles.buttonGroup}>
          {!canBuy && viewerIsStore && (
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.noticeText}>
                No puedes apartar productos con una cuenta de tienda. Cambia a una cuenta de cliente para solicitar este producto.
              </Text>
            </View>
          )}
          {effectiveStock > 0 && canBuy && (!hasVariants || !!selectedVariantId) && !intent && (
            <View style={styles.apartarRow}>
              <Button
                title="Apartar producto"
                onPress={handleApartar}
                loading={apartando}
                style={styles.apartarButton}
              />
              <QuantityStepper value={quantity} onChange={setQuantity} max={effectiveStock} />
            </View>
          )}
          {canBuy && intent && (
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
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/(business)/business/${product.business_id}`)}>
              <Ionicons name="storefront-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Ver negocio</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/(business)/negocio-catalogo/${product.business_id}`)}>
              <Ionicons name="grid-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Ver catálogo</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                const msg = encodeURIComponent(`Hola, estoy interesado en el producto "${product.name}". ¿Podrían darme más información?`);
                router.push(`/(business)/chat/${product.business_owner_id}?prefill=${msg}&sellerBusinessId=${product.business_id}`);
              }}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Chatear</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.text} />
              <Text style={styles.actionBtnLabel}>Compartir</Text>
            </Pressable>
          </View>
        </View>
      )}

      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[styles.sectionTitle, styles.relatedSectionTitle]}>También te puede interesar</Text>
          <FeedCatalogStrip
            items={relatedItems.filter((item) => item.photoUrl)}
            listItems={relatedItems.filter((item) => !item.photoUrl)}
            role="business"
          />
        </View>
      )}

      <ReportModal
        visible={showReportModal}
        targetLabel="este producto"
        onCancel={() => setShowReportModal(false)}
        onSubmit={handleReportProduct}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flexGrow: 1,
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
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  variantChipDisabled: {
    opacity: 0.5,
  },
  variantChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  variantChipTextSelected: {
    color: colors.primary,
  },
  variantChipTextDisabled: {
    color: colors.textMuted,
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
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
});
