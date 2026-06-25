import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';

export default function AuxilioScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auxilio en carretera</Text>
      <Text style={styles.placeholder}>
        Solicita ayuda y los talleres cercanos podrán verla y aceptarla.
      </Text>
      <Button title="Pedir auxilio" onPress={() => {}} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.sos,
  },
});
