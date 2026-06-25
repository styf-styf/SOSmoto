import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export default function BusinessHomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Solicitudes nuevas</Text>
        <Text style={styles.cardValue}>0</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Vistas del perfil (7 días)</Text>
        <Text style={styles.cardValue}>0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  cardValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
});
