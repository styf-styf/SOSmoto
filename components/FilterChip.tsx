import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// Chip de filtro compartido entre app/(client)/(tabs)/buscar.tsx y
// app/(business)/buscar.tsx -- mismo look que ya tenían ambos por separado.
export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.warningLight,
    },
    chipText: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: colors.primary,
    },
  });
}
