import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { colors } from '../constants/colors';

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
export function MarkerBitmapCapture({ label, color = colors.primary, avatarUrl, fallbackIcon, onReady }: MarkerBitmapCaptureProps) {
  const viewRef = useRef<View>(null);
  const showBubble = avatarUrl != null || fallbackIcon != null;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (avatarUrl) {
        await Image.prefetch(avatarUrl).catch(() => {});
      }
      // Margen de un frame para que el layout/paint del contenido (ya con
      // el avatar precargado) termine antes de capturar.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !viewRef.current) return;
      try {
        const uri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!cancelled) onReady(uri);
      } catch (err) {
        console.error('capture marker bitmap error', err);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, color, avatarUrl, fallbackIcon]);

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={viewRef} collapsable={false} style={styles.wrapper}>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
        </View>

        {showBubble ? (
          <View style={[styles.circle, { borderColor: color }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.fallback, { backgroundColor: color }]}>
                <Ionicons name={fallbackIcon!} size={16} color="#fff" />
              </View>
            )}
          </View>
        ) : (
          <Ionicons name="location" size={30} color={color} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
