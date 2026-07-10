import { useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Carrusel deslizable de fotos para la página de detalle de producto/servicio
// -- reemplaza la imagen única (photos[0]) cuando el ítem tiene más de una
// foto (ver services/catalog.ts PlanLimits.maxPhotosPerItem).
export function PhotoCarousel({ photos, sidePadding = 20 }: { photos: string[]; sidePadding?: number }) {
  const [index, setIndex] = useState(0);
  const imageWidth = SCREEN_WIDTH - sidePadding * 2;

  if (photos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / imageWidth));
        }}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={[styles.image, { width: imageWidth }]} resizeMode="cover" />
        )}
      />
      {photos.length > 1 && (
        <View style={styles.dotsRow}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  image: {
    aspectRatio: 3 / 4,
    borderRadius: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
