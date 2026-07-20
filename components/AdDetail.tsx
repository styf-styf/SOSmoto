import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { PhotoCarousel } from './PhotoCarousel';
import { getAdById, registerAdClick, type AdWithBusiness } from '../services/ads';

export function AdDetail({ adId, userRole = 'client' }: { adId: string; userRole?: 'client' | 'business' }) {
  const prefix = userRole === 'business' ? '/(business)' : '/(client)';
  const [ad, setAd] = useState<AdWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setAd(await getAdById(adId));
  }, [adId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load ad detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  // Al recuperar el foco (ej. volver de un enlace del anuncio) se refresca en
  // segundo plano, sin spinner, por si cambió el estado de la campaña.
  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh ad detail on focus error', err));
    }, [load])
  );

  function handleOpenLink() {
    if (!ad?.link_url) return;
    registerAdClick(ad.id).catch((err) => console.error('register ad click error', err));
    Linking.openURL(ad.link_url).catch(() => {});
  }

  // Cuando el anuncio está vinculado a un producto/servicio real (no uno
  // creado solo para la campaña), la conversión real (chat + intención de
  // compra/agenda) ya vive en esa página -- no se duplica acá, solo se
  // enlaza.
  function handleViewCatalogItem() {
    if (!ad) return;
    registerAdClick(ad.id).catch((err) => console.error('register ad click error', err));
    if (ad.product_id) {
      router.push(`${prefix}/(tabs)/producto/${ad.product_id}`);
    } else if (ad.service_id) {
      router.push(`${prefix}/(tabs)/servicio/${ad.service_id}`);
    }
  }

  // Solo aplica a anuncios "solo para la campaña" (sin product_id/service_id)
  // -- para los vinculados a un producto/servicio real, handleViewCatalogItem
  // ya lleva a una página que tiene su propio botón de chat, así que este
  // quedaría duplicado.
  function handleChat() {
    if (!ad) return;
    registerAdClick(ad.id).catch((err) => console.error('register ad click error', err));
    if (userRole === 'business') {
      if (!ad.business?.owner_id) return;
      router.push(`/(business)/chat/${ad.business.owner_id}?sellerBusinessId=${ad.business_id}`);
    } else {
      router.push(`/(client)/chat/${ad.business_id}`);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!ad) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este anuncio ya no está disponible.</Text>
      </View>
    );
  }

  const businessName = ad.business?.name ?? 'Anuncio';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {ad.business?.logo_url ? (
              <Image source={{ uri: ad.business.logo_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.authorName}>{businessName}</Text>
          {ad.business?.is_verified && (
            <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          )}
        </View>

        <View style={styles.imageWrap}>
          <PhotoCarousel photos={ad.photos} sidePadding={0} />
          <View style={styles.adChip}>
            <Ionicons name="megaphone" size={12} color="#fff" />
            <Text style={styles.adChipText}>Anuncio</Text>
          </View>
        </View>

        {ad.title && <Text style={styles.caption}>{ad.title}</Text>}

        <View style={styles.actionsRow}>
          {ad.link_url && (
            <Pressable style={styles.linkButton} onPress={handleOpenLink}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.linkButtonText}>{ad.link_label || 'Ver más'}</Text>
            </Pressable>
          )}

          {(ad.product_id || ad.service_id) && (
            <Pressable style={styles.catalogButton} onPress={handleViewCatalogItem}>
              <Ionicons name={ad.product_id ? 'cube-outline' : 'construct-outline'} size={16} color={colors.primary} />
              <Text style={styles.catalogButtonText}>{ad.product_id ? 'Ver producto' : 'Ver servicio'}</Text>
            </Pressable>
          )}

          {!ad.product_id && !ad.service_id && (
            <Pressable style={styles.catalogButton} onPress={handleChat}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.catalogButtonText}>Chatear</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 38,
    height: 38,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  imageWrap: {
    width: '100%',
  },
  adChip: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  caption: {
    fontSize: 15,
    color: colors.text,
    marginTop: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  catalogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catalogButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
