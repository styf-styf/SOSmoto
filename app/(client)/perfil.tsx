import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';

export default function ClientPerfilScreen() {
  const { profile } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile?.full_name ?? 'Perfil'}</Text>
      <Text style={styles.placeholder}>{profile?.email}</Text>
      <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} style={styles.button} />
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
    marginBottom: 4,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  button: {
    marginTop: 'auto',
  },
});
