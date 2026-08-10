import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// Idéntico entre app/(client)/(tabs)/buscar.tsx y app/(business)/buscar.tsx --
// compartido para no tener que tocar los dos archivos ante cualquier cambio.
export function SearchEmptyState({ text }: { text: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={28} color={colors.textMuted} />
      <Text style={styles.placeholder}>{text}</Text>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    emptyState: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 20,
    },
    placeholder: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
  });
}
