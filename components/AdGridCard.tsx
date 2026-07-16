import { useEffect } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import { registerAdImpression } from '../services/ads';
import type { AdWithBusiness } from '../services/ads';

// Tarjeta compacta para grid de 2 columnas (Buscar) -- a diferencia de
// AdBanner (estilo feed completo, con caption expandible y comentarios), esta
// es solo una miniatura de descubrimiento: imagen + degradado + nombre del
// negocio + chip "Anuncio", que lleva al detalle completo (AdDetail) al tocar.
const COLUMNS = 2;
const GAP = 10;
const SIDE_PADDING = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Math.floor (no Math.round) es a propósito: redondear hacia arriba puede
// hacer que 2*CARD_WIDTH + GAP supere por 1px el ancho real disponible
// (frecuente en Android, donde el ancho lógico de pantalla suele ser
// fraccionario), y ese único píxel de más basta para que flexWrap mande la
// segunda tarjeta de cada fila a la siguiente línea -- el grid "colapsa" a 1
// columna aunque el cálculo parezca correcto.
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));

export function AdGridCard({ ad, detailHref }: { ad: AdWithBusiness; detailHref: string }) {
  useEffect(() => {
    registerAdImpression(ad.id).catch((err) => console.error('register ad impression error', err));
  }, [ad.id]);

  const businessName = ad.business?.name ?? 'Anuncio';

  return (
    <Pressable style={styles.card} onPress={() => router.push(detailHref)}>
      <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
      <GradientShade height={Math.round(CARD_HEIGHT * 0.55)} />
      <View style={styles.businessBadge}>
        <View style={styles.businessAvatar}>
          {ad.business?.logo_url ? (
            <Image source={{ uri: ad.business.logo_url }} style={styles.businessAvatarImage} />
          ) : (
            <Ionicons name="storefront" size={10} color={colors.primary} />
          )}
        </View>
        <Text numberOfLines={1} style={styles.businessName}>
          {businessName}
        </Text>
      </View>
      {ad.title && (
        <Text numberOfLines={1} style={styles.title}>
          {ad.title}
        </Text>
      )}
      <View style={styles.adChip}>
        <Ionicons name="megaphone" size={10} color="#fff" />
        <Text style={styles.adChipText}>Anuncio</Text>
      </View>
    </Pressable>
  );
}

export const AD_GRID_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  businessBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  businessAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessAvatarImage: {
    width: 16,
    height: 16,
  },
  businessName: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  title: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 28,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  adChip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
