import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker } from 'react-native-maps';
import { colors } from '../constants/colors';

interface MapNamedMarkerProps {
  coordinate: { latitude: number; longitude: number };
  label: string;
  color?: string;
  avatarUrl?: string | null;
  fallbackIcon?: React.ComponentProps<typeof Ionicons>['name'];
  zIndex?: number;
}

const CIRC = 30;
const CHIP_H = 18; // fontSize:12, lineHeight:14, paddingVertical:2
const GAP = 0;
const MARKER_H = CHIP_H + CIRC; // 48dp

export function MapNamedMarker({
  coordinate,
  label,
  color = colors.primary,
  avatarUrl,
  fallbackIcon,
  zIndex,
}: MapNamedMarkerProps) {
  const showBubble = avatarUrl != null || fallbackIcon != null;

  // En Android, react-native-maps convierte este marcador (una vista JSX
  // normal) a un bitmap para dibujarlo sobre el mapa nativo -- si esa "foto"
  // se toma antes de que el avatar (que carga por red, async) termine de
  // pintarse, el snapshot queda con el círculo vacío para siempre
  // (tracksViewChanges solo controla SI se vuelve a tomar la foto). Cuando
  // la imagen ya estaba en caché de otra pantalla (ej. el propio avatar del
  // usuario, visto antes en su perfil) esto no se nota porque carga
  // instantáneo; cuando es la primera vez que se pide esa imagen en la
  // sesión (ej. el logo de un negocio nunca visitado antes), pierde la
  // carrera contra el snapshot y el avatar sale en blanco.
  //
  // Intento 1 (esperar el onLoad del <Image> antes de apagar
  // tracksViewChanges) e intento 2 (precargar con Image.prefetch() antes de
  // montar el <Image>, pero ACTUALIZANDO el mismo marcador y apagando
  // tracksViewChanges cuando queda lista) tampoco fueron suficientes -- el
  // puente nativo de Android no parece reaccionar de forma confiable a una
  // actualización a mitad de camino del mismo marcador.
  //
  // Intento 3 (fallido, revertido): además de precargar, se le cambiaba el
  // `key` una vez lista la imagen para forzar un remontaje limpio -- pero
  // el marcador NUEVO nacía con tracksViewChanges ya en `false` desde su
  // primer render, y aparentemente Android necesita al menos un render con
  // tracksViewChanges=true para generar la primera "foto" válida de un
  // marcador. Sin eso, el marcador nuevo se quedaba completamente en
  // blanco -- rompió hasta los casos que antes sí andaban bien (el propio
  // avatar, el logo del negocio en su propio mapa). Se revierte esa parte:
  // tracksViewChanges vuelve a quedar SIEMPRE true (como estaba
  // originalmente, la única variante confirmada sin regresiones), y se
  // mantiene solo el remontaje con key -- la imagen sigue llegando ya
  // precargada/tibia al marcador nuevo, que ahora además sigue
  // "trackeando" cambios permanentemente por si acaso.
  const [imageReady, setImageReady] = useState(!avatarUrl);

  useEffect(() => {
    if (!avatarUrl) {
      setImageReady(true);
      return;
    }
    setImageReady(false);
    let cancelled = false;
    Image.prefetch(avatarUrl)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setImageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  if (showBubble) {
    return (
      <Marker
        key={imageReady ? 'ready' : 'loading'}
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges
        zIndex={zIndex}
      >
        <View style={styles.wrapper} collapsable={false}>
          {/* Chip con nombre */}
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
          </View>

          {/* Círculo con avatar */}
          <View style={[styles.circle, { borderColor: color }]}>
            {avatarUrl && imageReady ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.fallback, { backgroundColor: color }]}>
                <Ionicons name={fallbackIcon!} size={16} color="#fff" />
              </View>
            )}
          </View>
        </View>
      </Marker>
    );
  }

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} zIndex={zIndex}>
      <View style={styles.classicWrap}>
        <View style={styles.classicBubble}>
          <Text style={styles.classicText} numberOfLines={1}>{label}</Text>
        </View>
        <Ionicons name="location" size={30} color={color} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    height: MARKER_H,
  },

  chip: {
    backgroundColor: '#fff',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    // Sin maxWidth a propósito -- con un tope fijo, un nombre largo
    // ("Taller MotoCentro Sangolquí") se veía cortado a la mitad
    // ("Taller Mot..."). El chip ahora crece según el contenido; el
    // `wrapper` que lo contiene tampoco tiene ancho fijo (eso sí causaba
    // que el marcador entero desapareciera, ver historial), así que no hay
    // riesgo de reintroducir ese bug.
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
    // 'cover' (el default) recorta al centro geométrico de la imagen -- si
    // la foto de perfil/logo no es cuadrada (ej. fotos subidas antes del
    // recorte 1:1 forzado, o cualquier fuente externa), y el sujeto no está
    // justo en ese centro, termina cortando la parte de arriba/abajo que
    // interesa. 'contain' muestra la imagen completa siempre, sin recortar
    // nada, sin importar la proporción real de la fuente.
    resizeMode: 'contain',
  },
  fallback: {
    width: CIRC - 6,
    height: CIRC - 6,
    borderRadius: (CIRC - 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  classicWrap: { alignItems: 'center' },
  classicBubble: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
  },
  classicText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
});
