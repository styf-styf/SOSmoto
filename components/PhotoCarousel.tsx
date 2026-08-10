import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { useImageAspectRatio } from '../hooks/useImageAspectRatio';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DEFAULT_RATIO = 3 / 4;

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const imageWidth = SCREEN_WIDTH - sidePadding * 2;

  // El marco (bordes redondeados + overflow:hidden) tiene que ser un
  // contenedor ESTÁTICO por fuera del FlatList -- antes el radio se aplicaba
  // a cada <Image>, así que al deslizar se veían dos rectángulos redondeados
  // independientes cruzándose (con el fondo asomando entre sus esquinas) en
  // vez de un solo marco fijo con la foto moviéndose adentro.
  // En modo naturalAspect el alto del marco sigue a la foto activa (cada una
  // puede tener su propia proporción) -- se recalcula recién al terminar el
  // swipe (onMomentumScrollEnd), no en cada frame del gesto, para no pelear
  // con la animación nativa de paginado. Mientras dura el gesto la foto
  // vecina se recorta (cover) al alto todavía vigente y encaja apenas se
  // suelta -- mismo criterio que ya usa el mini-carrusel de PostCard.
  const activeRatio = useImageAspectRatio(naturalAspect ? photos[index] : undefined);
  const ratio = naturalAspect ? activeRatio ?? DEFAULT_RATIO : DEFAULT_RATIO;
  const frameHeight = imageWidth / ratio;

  if (photos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { width: imageWidth, height: frameHeight }]}>
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
            <Image
              source={{ uri: item }}
              style={[styles.image, { width: imageWidth, height: frameHeight }]}
              resizeMode="cover"
            />
          )}
        />
      </View>
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

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 16,
    },
    frame: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    image: {
      backgroundColor: colors.background,
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
}
