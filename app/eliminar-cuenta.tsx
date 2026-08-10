import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { getPendingDeletionRequest, requestAccountDeletion } from '../services/accountDeletion';

// Formulario de "Eliminar cuenta" (Configuración > Cuenta, cliente y
// negocio) -- reemplaza el mailto: de antes por una solicitud real con
// período de gracia de 30 días (ver services/accountDeletion.ts). El motivo
// es opcional a propósito: no se debe bloquear la solicitud solo porque el
// usuario no quiera explicar por qué se va.
export default function EliminarCuentaScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!profile) return;
    // Si ya tiene una solicitud pendiente (ej. volvió a este link a mano),
    // no tiene sentido mostrarle el formulario de nuevo.
    getPendingDeletionRequest(profile.id)
      .then((existing) => {
        if (existing) {
          router.replace('/cuenta-eliminacion-pendiente');
        } else {
          setCheckingExisting(false);
        }
      })
      .catch((err) => {
        console.error('check existing deletion request error', err);
        setCheckingExisting(false);
      });
  }, [profile]);

  function handleSubmit() {
    if (!profile || submitting) return;
    Alert.alert(
      'Eliminar cuenta',
      'Tu cuenta quedará suspendida y se eliminará en 30 días. Puedes cancelar la solicitud en cualquier momento antes de esa fecha. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar mi cuenta',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await requestAccountDeletion(profile.id, reason);
              router.replace('/cuenta-eliminacion-pendiente');
            } catch (err) {
              console.error('request account deletion error', err);
              Alert.alert('Error', 'No se pudo enviar la solicitud. Intenta de nuevo.');
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  if (checkingExisting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.warningCard}>
        <Ionicons name="warning-outline" size={22} color={colors.danger} />
        <Text style={styles.warningText}>
          Tu cuenta quedará suspendida de inmediato y se eliminará definitivamente en 30 días. Durante ese tiempo
          puedes cancelar la solicitud desde la misma pantalla que vas a ver a continuación.
        </Text>
      </View>

      <TextField
        label="¿Por qué te vas? (opcional)"
        placeholder="Cuéntanos qué podríamos mejorar"
        value={reason}
        onChangeText={setReason}
        numberOfLines={4}
      />

      <Button
        title="Eliminar mi cuenta"
        variant="danger"
        onPress={handleSubmit}
        loading={submitting}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
      backgroundColor: colors.background,
    },
    warningCard: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: '#FBE8E8',
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
    },
    submitButton: {
      marginTop: 24,
    },
  });
}
