import { useEffect, useState } from 'react';
import { Image } from 'react-native';

// Cache en memoria (no persiste entre aperturas de la app) -- evita volver a
// medir la misma foto cada vez que su tarjeta se remonta por el
// windowing/reciclado del FlatList del feed.
const ratioCache = new Map<string, number>();

// Mide el ancho/alto real de una imagen remota para poder mostrarla en su
// proporción natural (a diferencia del resto de la app, que fuerza 3:4 al
// subir) -- usado por publicaciones, ver PostCard.tsx/PhotoCarousel.tsx.
// `clampMin`/`clampMax` acotan la proporción resultante (ancho/alto) sin
// necesidad de guardar el ancho/alto original en la base de datos.
export function useImageAspectRatio(
  uri: string | undefined,
  options?: { clampMin?: number; clampMax?: number }
): number | undefined {
  const [ratio, setRatio] = useState<number | undefined>(uri ? ratioCache.get(uri) : undefined);

  useEffect(() => {
    if (!uri) {
      setRatio(undefined);
      return;
    }
    const cached = ratioCache.get(uri);
    if (cached) {
      setRatio(cached);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || !height) return;
        let value = width / height;
        if (options?.clampMin) value = Math.max(value, options.clampMin);
        if (options?.clampMax) value = Math.min(value, options.clampMax);
        ratioCache.set(uri, value);
        setRatio(value);
      },
      () => {
        // Si falla la medición (uri inválida, sin conexión), se deja sin
        // valor -- el llamador decide su propio fallback.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri, options?.clampMin, options?.clampMax]);

  return ratio;
}
