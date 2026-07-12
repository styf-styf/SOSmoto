import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { changePassword } from '../../services/users';

export default function CambiarPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (newPassword.length < 6) {
      Alert.alert('Contraseña muy corta', 'Usa al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('No coinciden', 'Las contraseñas no son iguales.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Listo', 'Tu contraseña se actualizó.');
    } catch (err) {
      console.error('change password error', err);
      Alert.alert('Error', 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextField
        label="Nueva contraseña"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="Mínimo 6 caracteres"
      />
      <TextField
        label="Confirmar contraseña"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title="Actualizar contraseña" onPress={handleSave} loading={saving} style={styles.saveButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: colors.background,
  },
  saveButton: {
    marginTop: 24,
  },
});
