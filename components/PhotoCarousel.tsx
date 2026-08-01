import { useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { useImageAspectRatio } from '../hooks/useImageAspectRatio';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Una foto del carrusel en modo `naturalAspect` -- mide su propia proporción
// real sin límite (a diferencia del resto de la app, que fuerza 3:4). Cada
// foto es independiente, así que en un post con varias fotos de proporciones
// distintas cada una se ve completa, no recortada a la de la primera.
function NaturalAspectImage({ uri, width }: { uri: string; width: number }) {
  const ratio = useImageAspectRatio(uri);
  return (
    <Image
      source={{ uri }}
      style={[styles.image, { width, aspectRatio: ratio ?? 3 / 4 }]}
      resizeMode="cover"
    />
  );
}

// Carrusel deslizable de fotos. Por defecto fuerza 3:4 (ver DEFAULT_ASPECT en
// services/storage.ts) -- usado por la página de detalle de producto/servicio,
// sin cambios. `naturalAspect` es exclusivo de publicaciones (PostDetail.tsx):
// ahí la foto sube en el formato que el usuario eligió y se muestra completa,
// sin recortar ni forzar 3:4 -- ver services/storage.ts pickAndUpload*PostImage.
export function PhotoCarousel({
  photos,
  sidePadding = 20,
  naturalAspect = false,
}: {
  photos: string[];
  sidePadding?: number;
  naturalAspect?: boolean;
}) {
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
        renderItem={({ item }) =>
          naturalAspect ? (
            <NaturalAspectImage uri={item} width={imageWidth} />
          ) : (
            <Image source={{ uri: item }} style={[styles.image, { width: imageWidth }]} resizeMode="cover" />
          )
        }
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
