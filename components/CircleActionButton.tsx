import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

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
  color,
  variant = 'solid',
  onPress,
  loading,
  disabled,
}: CircleActionButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const circleColor = color ?? colors.primary;
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
            ? { backgroundColor: colors.background, borderWidth: 2, borderColor: circleColor }
            : { backgroundColor: circleColor },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isOutline ? circleColor : '#fff'} size="small" />
        ) : (
          <Ionicons name={icon} size={22} color={isOutline ? circleColor : '#fff'} />
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
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
}
