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

  if (showBubble) {
    return (
      <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} tracksViewChanges zIndex={zIndex}>
        <View style={styles.wrapper} collapsable={false}>
          {/* Chip con nombre */}
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
          </View>

          {/* Círculo con avatar */}
          <View style={[styles.circle, { borderColor: color }]}>
            {avatarUrl ? (
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
