import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export default function SolicitudesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Solicitudes de auxilio</Text>
      <Text style={styles.placeholder}>Aquí verás las solicitudes pendientes y activas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
