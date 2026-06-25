import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export default function BusinessMensajesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mensajes</Text>
      <Text style={styles.placeholder}>Tus chats con clientes aparecerán aquí.</Text>
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
