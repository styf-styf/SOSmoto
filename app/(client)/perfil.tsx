import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BusinessListItem } from '../../components/BusinessListItem';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';
import { getFollowedBusinesses } from '../../services/businesses';
import { changePassword, updateUserProfile } from '../../services/users';
import type { Business } from '../../types/database';

export default function ClientPerfilScreen() {
  const { profile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [following, setFollowing] = useState<Business[]>([]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      getFollowedBusinesses(profile.id)
        .then(setFollowing)
        .catch((err) => console.error('load followed businesses error', err));
    }, [profile])
  );

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{fullName || 'Perfil'}</Text>
          <Text style={styles.placeholder}>{profile?.email}</Text>
        </View>
        <Pressable onPress={() => router.push('/(client)/configuracion')}>
          <Ionicons name="settings-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Siguiendo</Text>
      {following.length === 0 ? (
        <Text style={styles.placeholder}>
          Aún no sigues a ningún negocio. Explora "Buscar" y sigue talleres para ver sus novedades aquí.
        </Text>
      ) : (
        following.map((business) => <BusinessListItem key={business.id} business={business} />)
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Datos personales</Text>
      <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button title="Guardar cambios" onPress={handleSaveProfile} loading={savingProfile} style={styles.saveButton} />

      <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
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

      <Button title="Mis motos" onPress={() => router.push('/(client)/vehiculos')} />
      <Button
        title="Mis historias"
        variant="secondary"
        onPress={() => router.push('/(client)/historias')}
        style={styles.spacedButton}
      />
      <Button
        title="Mis publicaciones"
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
      <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} style={styles.spacedButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  saveButton: {
    marginTop: 4,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  spacedButton: {
    marginTop: 12,
  },
});
