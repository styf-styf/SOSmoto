import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';

// Idéntico entre app/(client)/(tabs)/buscar.tsx y app/(business)/buscar.tsx --
// compartido para no tener que tocar los dos archivos ante cualquier cambio.
export function SearchEmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={28} color={colors.textMuted} />
      <Text style={styles.placeholder}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
