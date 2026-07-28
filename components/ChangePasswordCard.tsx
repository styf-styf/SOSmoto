import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors } from '../constants/colors';
import { changePassword } from '../services/users';

// Tarjeta de "Seguridad" (cambiar contraseña) -- se usa tanto en
// datos-personales.tsx (cliente) como en datos-negocio.tsx (negocio, ahí
// aplica al login de QUIEN esté viendo la pantalla, dueño o empleado, no al
// negocio en sí -- por eso no se gatea por `isOwner`). Antes vivía como
// pantalla propia (cambiar-password.tsx), ahora integrada en el perfil.
export function ChangePasswordCard() {
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function handleCancel() {
    setNewPassword('');
    setConfirmPassword('');
    setEditing(false);
  }

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
      setEditing(false);
      Alert.alert('Listo', 'Tu contraseña se actualizó.');
    } catch (err) {
      console.error('change password error', err);
      Alert.alert('Error', 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Seguridad</Text>
        {!editing && (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.changeLink}>Cambiar contraseña</Text>
          </Pressable>
        )}
      </View>

      {!editing ? (
        <Text style={styles.dots}>••••••••</Text>
      ) : (
        <>
          <TextField
            label="Nueva contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Mínimo 6 caracteres"
          />
          <TextField label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <View style={styles.actionsRow}>
            <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={handleCancel} disabled={saving} style={styles.flexButton} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  dots: {
    fontSize: 16,
    color: colors.text,
    letterSpacing: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
});
