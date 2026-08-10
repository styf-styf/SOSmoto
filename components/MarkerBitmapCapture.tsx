import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

const CIRC = 30;

export interface MarkerBitmapCaptureProps {
  label: string;
  color?: string;
  avatarUrl?: string | null;
  fallbackIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onReady: (uri: string) => void;
}

// Genera, fuera de pantalla, el "sello" visual del marcador (chip con
// nombre + círculo con avatar/ícono) y lo captura a un archivo de imagen
// real vía react-native-view-shot -- el <Marker image={{uri}}> real (en
// MapView, ver call sites) usa esa imagen ya resuelta, en vez de dejar que
// el mapa intente convertir una vista en vivo a un bitmap.
//
// Se abandona el enfoque anterior (vista JSX + tracksViewChanges) después
// de agotar 4 variantes distintas sin éxito -- el síntoma final (nombre
// recortado del lado derecho, con o sin avatar, con o sin
// tracksViewChanges, con o sin retrasar el montaje) confirmó que Android no
// vuelve a medir el bitmap cuando el contenido crece después del primer
// render, sin importar el timing. Un <Marker image=...> usa un ícono nativo
// directo, no una vista JS -- no depende de ningún snapshot en vivo, se
// captura UNA vez con el tamaño final ya resuelto y listo.
//
// Debe montarse FUERA de <MapView> (como hijo arbitrario de MapView, una
// vista normal no está soportada de forma confiable) -- se posiciona fuera
// de la pantalla visible para no ocupar espacio, pero sigue teniendo layout
// real (a diferencia de display:none, necesario para que capture algo).
export function MarkerBitmapCapture({ label, color, avatarUrl, fallbackIcon, onReady }: MarkerBitmapCaptureProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markerColor = color ?? colors.primary;
  const viewRef = useRef<View>(null);
  const showBubble = avatarUrl != null || fallbackIcon != null;
  // Image.prefetch() por sí solo no alcanza: calienta la caché, pero no
  // garantiza que ESTE <Image> en particular ya haya pintado sus píxeles en
  // la vista offscreen al momento exacto de capturar (salía el círculo en
  // blanco). Se espera la señal real de "esta imagen ya cargó" vía
  // onLoad/onError antes de disparar la captura.
  const [imageLoaded, setImageLoaded] = useState(!avatarUrl);

  useEffect(() => {
    setImageLoaded(!avatarUrl);
  }, [avatarUrl]);

  useEffect(() => {
    if (avatarUrl) {
      Image.prefetch(avatarUrl).catch(() => {});
    }
  }, [avatarUrl]);

  useEffect(() => {
    if (!imageLoaded) return;
    let cancelled = false;
    const raf = requestAnimationFrame(async () => {
      if (cancelled || !viewRef.current) return;
      try {
        const uri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!cancelled) onReady(uri);
      } catch (err) {
        console.error('capture marker bitmap error', err);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLoaded, label, markerColor, avatarUrl, fallbackIcon]);

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={viewRef} collapsable={false} style={styles.wrapper}>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
        </View>

        {showBubble ? (
          <View style={[styles.circle, { borderColor: markerColor }]}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            ) : (
              <View style={[styles.fallback, { backgroundColor: markerColor }]}>
                <Ionicons name={fallbackIcon!} size={16} color="#fff" />
              </View>
            )}
          </View>
        ) : (
          <Ionicons name="location" size={30} color={markerColor} />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    offscreen: {
      position: 'absolute',
      top: -1000,
      left: -1000,
    },
    wrapper: {
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: 4,
    },
    chip: {
      backgroundColor: '#fff',
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 14,
      includeFontPadding: false,
    },
    circle: {
      width: CIRC,
      height: CIRC,
      borderRadius: CIRC / 2,
      borderWidth: 3,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: CIRC - 6,
      height: CIRC - 6,
      borderRadius: (CIRC - 6) / 2,
      resizeMode: 'contain',
    },
    fallback: {
      width: CIRC - 6,
      height: CIRC - 6,
      borderRadius: (CIRC - 6) / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
