import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface CircleActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  variant?: 'solid' | 'outline';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const SIZE = 52;

export function CircleActionButton({
  icon,
  label,
  color = colors.primary,
  variant = 'solid',
  onPress,
  loading,
  disabled,
}: CircleActionButtonProps) {
  const isOutline = variant === 'outline';

  return (
    <Pressable
      style={styles.wrapper}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <View
        style={[
          styles.circle,
          isOutline
            ? { backgroundColor: '#fff', borderWidth: 2, borderColor: color }
            : { backgroundColor: color },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isOutline ? color : '#fff'} size="small" />
        ) : (
          <Ionicons name={icon} size={22} color={isOutline ? color : '#fff'} />
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});
