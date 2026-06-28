import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';
import { changePassword, updateUserProfile } from '../../services/users';

const SUPPORT_EMAIL = 'soporte@sosmoto.app';

export default function ConfiguracionScreen() {
  const { profile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.error('open settings error', err);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  async function handleSaveProfile() {
    if (!profile) return;
    if (!fullName.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa tu nombre completo.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfile(profile.id, { fullName: fullName.trim(), phone: phone.trim() || null });
      Alert.alert('Guardado', 'Tu perfil se actualizó.');
    } catch (err) {
      console.error('update profile error', err);
      Alert.alert('Error', 'No se pudo guardar los cambios.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      Alert.alert('Contraseña muy corta', 'Usa al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('No coinciden', 'Las contraseñas no son iguales.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Listo', 'Tu contraseña se actualizó.');
    } catch (err) {
      console.error('change password error', err);
      Alert.alert('Error', 'No se pudo cambiar la contraseña.');
    } finally {
      setSavingPassword(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      'Para eliminar tu cuenta, escríbenos a soporte. Te confirmaremos por correo cuando se complete.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Escribir a soporte',
          onPress: () => {
            const subject = encodeURIComponent('Eliminar mi cuenta');
            const body = encodeURIComponent(`Hola, quiero eliminar mi cuenta (${profile?.email ?? ''}).`);
            Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch((err) =>
              console.error('open mail error', err)
            );
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Cuenta</Text>
      <Button
        title={profile?.is_limited ? 'Estado de cuenta · Limitado' : 'Estado de cuenta'}
        variant="secondary"
        onPress={() => router.push('/(client)/estado-cuenta')}
        style={styles.saveButton}
      />
      <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button title="Guardar cambios" onPress={handleSaveProfile} loading={savingProfile} style={styles.saveButton} />

      <Text style={styles.subTitle}>Cambiar contraseña</Text>
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
      <Button
        title="Actualizar contraseña"
        variant="secondary"
        onPress={handleChangePassword}
        loading={savingPassword}
        style={styles.saveButton}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Vehículos</Text>
      <Button title="Mis motos" variant="secondary" onPress={() => router.push('/(client)/vehiculos')} />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Actividad</Text>
      <Button title="Mis historias" variant="secondary" onPress={() => router.push('/(client)/historias')} />
      <Button
        title="Gestionar publicaciones"
        variant="secondary"
        onPress={() => router.push('/(client)/publicaciones')}
        style={styles.spacedButton}
      />
      <Button
        title="Mis citas"
        variant="secondary"
        onPress={() => router.push('/(client)/citas')}
        style={styles.spacedButton}
      />
      <Button
        title="Historial de servicios"
        variant="secondary"
        onPress={() => router.push('/(client)/historial')}
        style={styles.spacedButton}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Privacidad y ubicación</Text>
      <Text style={styles.helperText}>
        Auxilio en carretera y búsqueda cercana necesitan permiso de ubicación. Si lo desactivaste, actívalo desde
        los ajustes del teléfono.
      </Text>
      <Button title="Abrir ajustes del teléfono" variant="secondary" onPress={handleOpenSettings} />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Notificaciones</Text>
      <Text style={styles.helperText}>
        {profile?.push_token
          ? 'Las notificaciones push están activadas en este dispositivo.'
          : 'Las notificaciones push no están activas en este dispositivo (no disponibles en Expo Go; usa una build de desarrollo).'}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>General</Text>
      <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} />
      <Button
        title="Eliminar cuenta"
        variant="secondary"
        onPress={handleDeleteAccount}
        style={styles.spacedButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  saveButton: {
    marginTop: 4,
    marginBottom: 24,
  },
  spacedButton: {
    marginTop: 12,
  },
});
