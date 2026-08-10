import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: ButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isOutline = isSecondary || isDanger;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isDanger ? styles.danger : isSecondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? (isDanger ? colors.danger : colors.primary) : '#fff'} />
      ) : (
        <Text style={[styles.text, isSecondary && styles.textSecondary, isDanger && styles.textDanger]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    base: {
      height: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    danger: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    disabled: {
      opacity: 0.6,
    },
    text: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    textSecondary: {
      color: colors.primary,
    },
    textDanger: {
      color: colors.danger,
    },
  });
}
