import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';

const SUPPORT_EMAIL = 'soporte@sosmoto.app';

export default function ConfiguracionScreen() {
  const { profile } = useAuth();

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
    padding: 20,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
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
  spacedButton: {
    marginTop: 12,
  },
});
