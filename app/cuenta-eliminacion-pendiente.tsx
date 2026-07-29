import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/auth';
import { cancelAccountDeletion, getPendingDeletionRequest } from '../services/accountDeletion';
import type { AccountDeletionRequest } from '../types/database';

// Pantalla exclusiva mientras hay una solicitud de eliminación pendiente --
// intercepta TODA la navegación normal (ver app/index.tsx), incluido el
// botón SOS: quien pidió eliminar su cuenta no puede usar el resto de la
// app hasta que cancele la solicitud.
export default function CuentaEliminacionPendienteScreen() {
  const { profile } = useAuth();
  const [request, setRequest] = useState<AccountDeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!profile) return;
    getPendingDeletionRequest(profile.id)
      .then((data) => {
        if (!data) {
          // Ya no hay solicitud pendiente (se canceló desde otro dispositivo,
          // o ya se completó) -- no tiene sentido dejarlo varado acá.
          router.replace('/');
          return;
        }
        setRequest(data);
      })
      .catch((err) => console.error('load pending deletion request error', err))
      .finally(() => setLoading(false));
  }, [profile]);

  function handleCancel() {
    if (!request || cancelling) return;
    Alert.alert('Cancelar eliminación', '¿Quieres cancelar la eliminación de tu cuenta?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelAccountDeletion(request.id);
            router.replace('/');
          } catch (err) {
            console.error('cancel account deletion error', err);
            Alert.alert('Error', 'No se pudo cancelar la solicitud. Intenta de nuevo.');
            setCancelling(false);
          }
        },
      },
    ]);
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('sign out error', err);
    }
  }

  if (loading || !request) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const scheduledDate = new Date(request.scheduled_for).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="time-outline" size={40} color={colors.danger} />
      </View>
      <Text style={styles.title}>Tu cuenta se eliminará el {scheduledDate}</Text>
      <Text style={styles.body}>
        Pediste eliminar tu cuenta el {new Date(request.requested_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}.
        Mientras tanto tu cuenta queda suspendida y no puedes usar la app. Si cambiaste de opinión, puedes cancelar la
        eliminación en cualquier momento antes de esa fecha.
      </Text>

      <Button title="Cancelar eliminación" onPress={handleCancel} loading={cancelling} />
      <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.background,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FBE8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
});
