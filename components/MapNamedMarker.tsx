import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker } from 'react-native-maps';
import { colors } from '../constants/colors';

interface MapNamedMarkerProps {
  coordinate: { latitude: number; longitude: number };
  label: string;
  color?: string;
}

export function MapNamedMarker({ coordinate, label, color = colors.primary }: MapNamedMarkerProps) {
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }}>
      <View style={styles.wrap}>
        <View style={styles.labelBubble}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Ionicons name="location" size={30} color={color} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  labelBubble: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
});
