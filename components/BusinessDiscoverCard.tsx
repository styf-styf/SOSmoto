import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import type { BusinessWithDistance } from '../services/businesses';

const bizTypeLabel: Record<string, string> = {
  workshop: 'Taller',
  store: 'Tienda',
  brand_advertiser: 'Marca',
};

function ratingStarIcons(rating: number): Array<'star' | 'star-half' | 'star-outline'> {
  const icons: Array<'star' | 'star-half' | 'star-outline'> = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) icons.push('star');
    else if (rating >= i - 0.5) icons.push('star-half');
    else icons.push('star-outline');
  }
  return icons;
}

// Misma tarjeta que "Nuevos/Nuevas cerca de ti" en el home (ver
// app/(client)/(tabs)/index.tsx y app/(business)/(tabs)/index.tsx): imagen
// del negocio a pantalla completa, degradado oscuro, y nombre/tipo/
// distancia/calificación sobrepuestos en blanco. Acá se usa en grilla de 2
// columnas en el buscador, por eso el ancho es variable (prop `width`) en
// vez de la constante fija del carrusel del home.
export function BusinessDiscoverCard({
  business,
  width,
  hrefPrefix = '/(client)',
}: {
  business: BusinessWithDistance;
  width: number;
  hrefPrefix?: '/(client)' | '/(business)';
}) {
  return (
    <View style={[styles.cardShadow, { width, height: width }]}>
      <Pressable style={styles.card} onPress={() => router.push(`${hrefPrefix}/business/${business.id}`)}>
        {business.logo_url ? (
          <Image source={{ uri: business.logo_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="storefront" size={28} color={colors.primary} />
          </View>
        )}
        <GradientShade height={Math.round(width * 0.6)} />
        {business.is_verified && (
          <View style={styles.verifiedDot}>
            <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          </View>
        )}
        <Text numberOfLines={1} style={styles.name}>
          {business.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {bizTypeLabel[business.business_type] ?? 'Negocio'}
          {business.distance_km !== null
            ? ` · ${business.distance_km.toFixed(1)} km`
            : business.city
              ? ` · ${business.city}`
              : ''}
        </Text>
        {business.rating_avg > 0 && (
          <View style={styles.ratingRow}>
            {ratingStarIcons(business.rating_avg).map((icon, i) => (
              <Ionicons key={i} name={icon} size={11} color="#fff" />
            ))}
            <Text style={styles.rating}>{business.rating_avg.toFixed(1)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  card: {
    flex: 1,
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
  imagePlaceholder: {
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  name: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 48,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  meta: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 29,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  ratingRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
